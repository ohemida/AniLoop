"""Local development server with HTTP byte ranges for complete music and video."""
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
import argparse,re,os,json,shutil,subprocess,sys,errno,gzip,threading
from io import BytesIO
from hint_media import HintMedia
from urllib.parse import urlsplit,parse_qs
from http.cookies import SimpleCookie
from community import Community,APIError
from media_cache import MediaCache
from rooms import Rooms
from rewards import Rewards
from friends import Friends
from bugs import BugReports
from retention import Maintenance
from supabase_auth import SupabaseAuth

class Handler(SimpleHTTPRequestHandler):
    def log_message(self,format,*args):
        maintenance=getattr(self.server,'maintenance',None)
        if maintenance:
            try:maintenance.log_request(getattr(self,'_response_status',500))
            except OSError:pass
    def send_response(self,code,message=None):
        self._response_status=code
        return super().send_response(code,message)
    _text_cache={}
    _text_lock=threading.Lock()
    def text_response(self,path):
        stat=path.stat();stamp=(stat.st_mtime_ns,stat.st_size)
        etag='"%x-%x"'%stamp
        accepts_gzip=bool(re.search(r'(?:^|,)\s*gzip\s*(?:,|$|;\s*q=(?!0(?:\.0*)?(?:\s*,|$))[0-9.]+)',self.headers.get('Accept-Encoding','')))
        self._text_response=True
        if self.headers.get('If-None-Match')==etag:
            self.send_response(304);self.send_header('ETag',etag);self.send_header('Vary','Accept-Encoding');self.end_headers();return None
        key=str(path)
        with self._text_lock:
            cached=self._text_cache.get(key)
            if not cached or cached[0]!=stamp:
                raw=path.read_bytes();cached=(stamp,raw,gzip.compress(raw,compresslevel=5,mtime=0));self._text_cache[key]=cached
        data=cached[2 if accepts_gzip else 1]
        self.send_response(200);self.send_header('Content-Type',self.guess_type(str(path)));self.send_header('Content-Length',str(len(data)));self.send_header('ETag',etag);self.send_header('Vary','Accept-Encoding')
        if accepts_gzip:self.send_header('Content-Encoding','gzip')
        self.end_headers();return BytesIO(data)

    def authenticated_user(self):
        token=self.session_token();cloud=getattr(self.server,'supabase',None)
        if SupabaseAuth.cloud_token(token):return cloud.user(token) if cloud else None
        return self.server.community.user(token)
    def logout_session(self,token):
        cloud=getattr(self.server,'supabase',None)
        if SupabaseAuth.cloud_token(token):
            if cloud:cloud.logout(token)
        else:self.server.community.logout(token)
    def send_head(self):
        self._remaining=None
        self._text_response=False
        route=urlsplit(self.path).path
        if any(part.startswith('.') for part in Path(self.translate_path(self.path)).relative_to(Path(self.directory)).parts):
            self.send_error(404);return None
        if route=='/api/config':
            cloud=getattr(self.server,'supabase',None)
            data=json.dumps({'supabaseEnabled':bool(cloud),'defaultAuthProvider':'supabase' if cloud else 'local','gameDataStorage':'local-backend'}).encode()
            self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(data)));self.end_headers();return BytesIO(data)
        if route=='/api/account/picture':
            try:
                picture=self.server.community.picture(self.authenticated_user())
                if picture is None:raise APIError('No profile picture.',404)
                self.send_response(200);self.send_header('Content-Type','image/png');self.send_header('Content-Length',str(len(picture)));self.end_headers();return BytesIO(picture)
            except APIError as error:self.json_error(error.status,error.message);return None
        if route in {'/api/admin','/api/account','/api/account/export','/api/leaderboard','/api/rooms/current','/api/rooms/view','/api/rewards','/api/friends'}:
            try:
                if route=='/api/admin':result=self.server.community.admin_summary(self.authenticated_user())
                elif route=='/api/account':
                    user=self.authenticated_user()
                    result={'user':dict(user,isAdmin=self.server.community.is_admin(user),hasPicture=bool(self.server.community.picture(user))) if user else None}
                elif route=='/api/account/export':
                    user=self.authenticated_user()
                    if not user:raise APIError('Sign in to continue.',401)
                    result=self.server.supabase.export(user,self.session_token()) if user.get('provider')=='supabase' else self.server.community.export(user)
                elif route in {'/api/rooms/current','/api/rooms/view','/api/rewards','/api/friends'}:
                    user=self.authenticated_user()
                    if not user:raise APIError('Sign in to continue.',401)
                    if route=='/api/friends':result=self.server.friends.view(user,parse_qs(urlsplit(self.path).query).get('day',[None])[0])
                    elif route=='/api/rewards':result={'rewards':self.server.rewards.get(user)}
                    elif route.endswith('/current'):result=self.server.rooms.current(user)
                    else:result=self.server.rooms.get(user,parse_qs(urlsplit(self.path).query).get('code',[''])[0])
                else:
                    query=parse_qs(urlsplit(self.path).query);result=self.server.community.leaderboard(query.get('mode',['infinity'])[0],query.get('period',['all'])[0])
                data=json.dumps(result).encode()
                self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(data)));self.end_headers();return BytesIO(data)
            except APIError as error:self.json_error(error.status,error.message);return None
        if route=='/api/health':
            data=json.dumps({'app':'AniLoop','hintApi':1,'communityApi':1,'roomsApi':1,'rewardsApi':1,'friendsApi':1,'ffmpeg':bool(shutil.which('ffmpeg')),'ffprobe':bool(shutil.which('ffprobe'))}).encode()
            self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(data)));self.end_headers();return BytesIO(data)
        if route.startswith('/hints/'):
            try:path=self.server.hint_media.get(route[len('/hints/'):])
            except FileNotFoundError:self.send_error(404,'Unknown hint');return None
        elif route.startswith('/media/'):
            try:path=self.server.media_cache.get(route[len('/media/'):])
            except FileNotFoundError:self.send_error(404,'Unknown media ID');return None
            except (OSError,ValueError):self.send_error(502,'Media source temporarily unavailable');return None
        else:
            if route not in {'/','/admin.html','/index.html','/app.js','/catalog.js','/social-ui.js','/core.js','/storage.js','/styles.css','/skin.css'} and not route.startswith(('/assets/','/data/')):
                self.send_error(404);return None
            path=Path(self.translate_path(self.path))
            if path.name.endswith('.session-key') or path.suffix.lower() in {'.db','.sqlite','.sqlite3','.py'} or path.is_dir() and route!='/':
                self.send_error(404);return None
        if route=='/':path=Path(self.directory)/'index.html'
        if path.is_file() and path.suffix.lower() in {'.json','.js','.css','.html','.svg'}:
            return self.text_response(path)
        if path.is_file() and path.suffix.lower() in {'.mp3','.mp4','.webm','.ogg','.wav'}:
            size=path.stat().st_size
            value=self.headers.get('Range')
            if value:
                m=re.fullmatch(r'bytes=(\d*)-(\d*)',value)
                try:
                    if not m or not any(m.groups()):raise ValueError()
                    first,last=m.groups()
                    if first:
                        start=int(first);end=min(int(last),size-1) if last else size-1
                    else:
                        count=int(last)
                        if count<=0:raise ValueError()
                        start=max(0,size-count);end=size-1
                    if start>=size or end<start:raise ValueError()
                except ValueError:
                    self.send_response(416);self.send_header('Content-Range',f'bytes */{size}');self.send_header('Content-Length','0');self.end_headers();return None
                f=path.open('rb');f.seek(start);self._remaining=end-start+1
                self.send_response(206);self.send_header('Content-Type',self.guess_type(str(path)))
                self.send_header('Content-Length',str(self._remaining));self.send_header('Content-Range',f'bytes {start}-{end}/{size}');self.send_header('Accept-Ranges','bytes');self.end_headers();return f
        if route.startswith(('/media/','/hints/')):
            self.send_response(200);self.send_header('Content-Type',self.guess_type(str(path)));self.send_header('Content-Length',str(path.stat().st_size));self.send_header('Accept-Ranges','bytes');self.end_headers();return path.open('rb')
        return super().send_head()
    def session_token(self):
        try:
            cookie=SimpleCookie(self.headers.get('Cookie',''));return cookie['aniloop_session'].value if 'aniloop_session' in cookie else ''
        except Exception:return ''
    def cookie(self,token,clear=False):
        secure='; Secure' if os.environ.get('ANILOOP_SECURE_COOKIES')=='1' or os.environ.get('ANILOOP_PUBLIC_ORIGIN','').startswith('https://') else ''
        return f'aniloop_session={token}; Path=/; HttpOnly; SameSite=Lax; Max-Age={0 if clear else 30*86400}{secure}'
    def community_post(self):
        if self.headers.get_content_type()!='application/json' or self.headers.get('Sec-Fetch-Site')=='cross-site':
            self.json_error(403,'Use the same-origin JSON API.');return
        origin=self.headers.get('Origin')
        expected=os.environ.get('ANILOOP_PUBLIC_ORIGIN')
        if origin and (origin.rstrip('/')!=expected.rstrip('/') if expected else urlsplit(origin).netloc!=self.headers.get('Host')):
            self.json_error(403,'Request origin is not allowed.');return
        try:
            size=int(self.headers.get('Content-Length','0'))
            if not 0<size<=1024*1024:raise APIError('Request exceeds 1 MB.')
            payload=json.loads(self.rfile.read(size))
            if not isinstance(payload,dict):raise APIError('Expected a JSON object.')
            service=self.server.community;token=self.session_token();user=None if self.path in {'/api/register','/api/login','/api/logout','/api/bugs'} else self.authenticated_user();cookie=None
            if self.path in {'/api/register','/api/login'}:
                if self.path=='/api/register' and payload.get('adultConfirmed') is not True:raise APIError('Accounts are for adults aged 18 or over. Confirm your age to register.')
                provider=payload.get('provider','local')
                if provider not in {'local','supabase'}:raise APIError('Unknown account provider.')
                auth_service=getattr(self.server,'supabase',None) if provider=='supabase' else service
                if not auth_service:raise APIError('Supabase is not configured on this server.',503)
                user,new_token=auth_service.auth(payload,self.path=='/api/register',self.client_address[0])
                if new_token:
                    if token:self.logout_session(token)
                    cookie=self.cookie(new_token)
                result={'user':dict(user,isAdmin=service.is_admin(user),hasPicture=bool(service.picture(user))) if user else None,'requiresConfirmation':provider=='supabase' and new_token is None}
            elif self.path=='/api/bugs':
                result=self.server.bugs.submit(payload,self.client_address[0])
            elif self.path=='/api/logout':
                self.logout_session(token);result={'ok':True};cookie=self.cookie('',True)
            else:
                if not user:raise APIError('Sign in to continue.',401)
                if self.path=='/api/admin/action':result=service.admin_change(user,payload)
                elif self.path=='/api/account/picture':
                    service.throttle('picture:'+str(user['id']));result=service.set_picture(user,payload)
                elif self.path.startswith('/api/friends/'):
                    result=self.server.friends.change(user,self.path.rsplit('/',1)[1],payload)
                elif self.path=='/api/scores':result=service.submit(user,payload.get('round'))
                elif self.path=='/api/rooms/create':
                    service.throttle('rooms:'+self.client_address[0]);result=self.server.rooms.create(user,payload.get('mode'))
                elif self.path=='/api/rooms/join':
                    service.throttle('rooms:'+self.client_address[0]);result=self.server.rooms.join(user,payload.get('code'))
                elif self.path=='/api/rooms/action':result=self.server.rooms.action(user,payload.get('code'),payload)
                elif self.path=='/api/rewards/claim':result=self.server.rewards.claim(user,payload.get('round'))
                elif self.path in {'/api/rewards/buy','/api/rewards/equip'}:result=self.server.rewards.cosmetic(user,payload.get('item'),self.path.endswith('/equip'))
                elif self.path=='/api/account/delete':
                    service.throttle(self.client_address[0])
                    if user.get('provider')=='supabase':self.server.supabase.delete(user,payload.get('password'),token)
                    else:service.delete(user,payload.get('password'))
                    result={'ok':True};cookie=self.cookie('',True)
                else:raise APIError('Unknown endpoint.',404)
            data=json.dumps(result).encode();self.send_response(200)
            self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(data)))
            if cookie:self.send_header('Set-Cookie',cookie)
            self.end_headers();self.wfile.write(data)
        except APIError as error:self.json_error(error.status,error.message)
        except (ValueError,TypeError,KeyError):self.json_error(400,'Invalid JSON request.')
        except Exception:
            self.log_error('Account API request failed');self.json_error(500,'The account service could not complete this request.')
    def json_error(self,status,message):
        data=json.dumps({'error':message}).encode()
        self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
    def do_POST(self):
        if self.path in {'/api/admin/action','/api/account/picture','/api/bugs','/api/register','/api/login','/api/logout','/api/account/delete','/api/scores','/api/rooms/create','/api/rooms/join','/api/rooms/action','/api/rewards/claim','/api/rewards/buy','/api/rewards/equip','/api/friends/request','/api/friends/accept','/api/friends/decline','/api/friends/cancel','/api/friends/remove'}:
            self.community_post();return
        if self.path != '/api/hints':
            self.send_error(404);return
        if self.headers.get('Sec-Fetch-Site') == 'cross-site' or self.headers.get_content_type() != 'application/json':
            self.send_error(403);return
        try:
            size=int(self.headers.get('Content-Length','0'))
            if not 0<size<=36*1024**2:raise ValueError('Invalid request size')
            result=self.server.hint_media.create(json.loads(self.rfile.read(size)))
            data=json.dumps(result).encode()
            self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
        except FileNotFoundError as error:
            tool=getattr(error,'filename',None)
            self.json_error(503,'Install ffmpeg and ffprobe, then restart the server.' if tool in {'ffmpeg','ffprobe'} else 'The media source is missing. Check its library entry.')
        except (ValueError,KeyError,TypeError):self.json_error(400,'Invalid or unregistered hint source. Upload the file or choose registered media.')
        except subprocess.TimeoutExpired:self.json_error(504,'Media processing took too long. Try the hint again.')
        except (OSError,subprocess.CalledProcessError):
            self.log_error('Hint source download or processing failed')
            self.json_error(502,'The media could not be downloaded or decoded. Retry or check its library source.')
        except Exception:
            self.log_error('Unexpected hint processing failure')
            self.json_error(500,'Hint processing failed. Check the local server terminal.')
    def copyfile(self,source,outputfile):
        if self._remaining is None:return super().copyfile(source,outputfile)
        left=self._remaining
        while left>0:
            data=source.read(min(64*1024,left))
            if not data:break
            outputfile.write(data);left-=len(data)
    def end_headers(self):
        route=urlsplit(self.path).path
        immutable=route.startswith(('/media/','/hints/')) and getattr(self,'_response_status',0) in {200,206}
        self.send_header('Cache-Control','no-store' if route.startswith('/api/') else 'public, max-age=31536000, immutable' if immutable else 'no-cache');self.send_header('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; media-src 'self' https: data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");self.send_header('Permissions-Policy','camera=(), microphone=(), geolocation=()');self.send_header('Referrer-Policy','no-referrer');self.send_header('X-Frame-Options','DENY');self.send_header('X-Content-Type-Options','nosniff');super().end_headers()
    def handle(self):
        try:super().handle()
        except (BrokenPipeError,ConnectionResetError):pass

if __name__=='__main__':
    parser=argparse.ArgumentParser(description='Start AniLoop locally')
    parser.add_argument('--host',default=os.environ.get('HOST','127.0.0.1'));parser.add_argument('--port',type=int,default=int(os.environ.get('PORT','8097')));parser.add_argument('--cache-mb',type=int,default=2048);args=parser.parse_args()
    if args.cache_mb<100:parser.error('--cache-mb must be at least 100')
    root=str(Path(__file__).resolve().parent)
    from functools import partial
    explicit_port=any(arg=='--port' or arg.startswith('--port=') for arg in sys.argv[1:])
    while True:
        try:
            server=ThreadingHTTPServer((args.host,args.port),partial(Handler,directory=root));break
        except OSError as error:
            if error.errno!=errno.EADDRINUSE or explicit_port or args.port>=8107:raise
            print(f'Port {args.port} is already in use; trying {args.port+1}.',flush=True)
            args.port+=1
    with server:
        server.community=Community(root,os.environ.get('ANILOOP_DB'))
        server.supabase=None
        project_file=Path(root)/'supabase/project.json'
        project=json.loads(project_file.read_text()) if project_file.exists() else {}
        if os.environ.get('ANILOOP_SUPABASE_ENABLED',str(int(project.get('enabled',False))))=='1':
            server.supabase=SupabaseAuth(server.community,os.environ.get('ANILOOP_SUPABASE_URL',project.get('url','')),os.environ.get('ANILOOP_SUPABASE_PUBLISHABLE_KEY',project.get('publishableKey','')),os.environ.get('ANILOOP_PUBLIC_ORIGIN') or (f'http://localhost:{args.port}' if args.host in {'127.0.0.1','localhost'} else None))
        server.bugs=BugReports(server.community)
        server.friends=Friends(server.community)
        server.rooms=Rooms(server.community);server.rewards=Rewards(server.community)
        server.maintenance=Maintenance(server.community,backups=os.environ.get('ANILOOP_MANAGED_BACKUPS')=='1',access_logs=os.environ.get('ANILOOP_ACCESS_LOG')=='1')
        server.maintenance.start()
        server.media_cache=MediaCache(root,args.cache_mb*1024**2)
        server.hint_media=HintMedia(root,server.media_cache)
        print(f'AniLoop: http://localhost:{args.port}',flush=True)
        try:server.serve_forever()
        except KeyboardInterrupt:pass
        finally:server.maintenance.stop()

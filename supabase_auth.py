"""Supabase identities with opaque HttpOnly local sessions; game data stays local.

Only a publishable key is used. JWT/refresh tokens are encrypted on the server,
never put in browser storage. Opaque HttpOnly sign-in survives backend restarts.
"""
from pathlib import Path
import base64,hashlib,json,re,secrets,threading,time,uuid
from urllib.parse import urlsplit,urlencode
from urllib.request import Request,urlopen
from urllib.error import HTTPError,URLError
from community import APIError

class SupabaseAuth:
    def __init__(self,community,url,key,origin=None,request=None):
        parsed=urlsplit(url)
        if parsed.scheme!='https' or not parsed.hostname or not parsed.hostname.endswith('.supabase.co') or parsed.path not in ('','/') or parsed.query or parsed.fragment or parsed.username or parsed.password or parsed.port:
            raise ValueError('Use the HTTPS Supabase project base URL, without /rest/v1/.')
        if not key.startswith('sb_publishable_'):raise ValueError('Use a Supabase publishable key, never a secret key.')
        self.community=community;self.url=url.rstrip('/');self.key=key;self.origin=origin
        self.request=request or self._request;self.sessions={};self.lock=threading.RLock()
        with community.db() as db:
            db.execute('CREATE TABLE IF NOT EXISTS supabase_project_binding(id INTEGER PRIMARY KEY CHECK(id=1),url TEXT NOT NULL)')
            binding=db.execute('SELECT url FROM supabase_project_binding WHERE id=1').fetchone()
            if binding and binding['url']!=self.url:raise ValueError('This game database is bound to a different Supabase project. Use a separate database; identities are never merged across projects.')
            db.execute('INSERT OR IGNORE INTO supabase_project_binding VALUES(1,?)',(self.url,))
            db.execute('CREATE TABLE IF NOT EXISTS supabase_identities(subject TEXT PRIMARY KEY,user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE)')
        from session_store import SessionStore
        self.store=SessionStore(community,self.url)
    def _request(self,path,payload=None,token=None,method=None):
        headers={'apikey':self.key,'Content-Type':'application/json'}
        if token:headers['Authorization']='Bearer '+token
        data=None if payload is None else json.dumps(payload).encode()
        request=Request(self.url+path,data=data,headers=headers,method=method or ('POST' if data is not None else 'GET'))
        try:
            with urlopen(request,timeout=15) as response:
                raw=response.read(1024*1024+1)
                if len(raw)>1024*1024:raise APIError('Supabase response is too large.',502)
                return json.loads(raw) if raw else {}
        except HTTPError as error:
            raw=error.read(65536)
            try:code=json.loads(raw).get('code') or json.loads(raw).get('error_code')
            except (ValueError,AttributeError):code=None
            if code=='23505':raise APIError('This username is already taken.',409) from None
            if code=='PGRST202':raise APIError('Cloud account actions are not configured on this server. Contact dailyaniloop@gmail.com. No local data was deleted.',503) from None
            if code=='email_not_confirmed':raise APIError('Confirm your email before signing in.',403) from None
            if code in {'over_email_send_rate_limit','over_request_rate_limit'} or error.code==429:raise APIError('Supabase rate limit reached. Try again later.',429) from None
            if code in {'email_address_not_authorized','email_address_invalid','email_address_not_allowed'}:raise APIError('Email delivery is restricted by the Supabase project. Configure Auth SMTP before inviting users.',400) from None
            if error.code in {400,401,403}:raise APIError('Supabase could not authenticate this request. Check your email/password, confirmation email and project settings.',401) from None
            raise APIError('Supabase is temporarily unavailable. Try again later.',502) from None
        except (URLError,TimeoutError,OSError,ValueError):raise APIError('Supabase is temporarily unavailable. Try again later.',503) from None
    @staticmethod
    def cloud_token(token):return isinstance(token,str) and token.startswith('sb.')
    def _key(self,token):return hashlib.sha256(token.encode()).hexdigest()
    def _profile(self,access,remote,adult):
        subject=str(uuid.UUID(remote['id']))
        rows=self.request('/rest/v1/aniloop_profiles?'+urlencode({'id':'eq.'+subject,'select':'id,username,created_at'}),token=access)
        if not rows:
            if adult is not True:raise APIError('Confirm that you are 18 or older.')
            username=remote.get('user_metadata',{}).get('username') or 'Player_'+uuid.UUID(subject).hex[:12]
            if not isinstance(username,str) or not re.fullmatch(r'[A-Za-z0-9_-]{3,24}',username):raise APIError('Use a valid public username.')
            with self.community.db() as db:
                if db.execute('SELECT 1 FROM users WHERE username=?',(username,)).fetchone():raise APIError('That username is reserved by an existing local account. Choose another public username.',409)
            self.request('/rest/v1/rpc/aniloop_create_profile',{'p_username':username,'p_adult_confirmed':True},access)
            rows=self.request('/rest/v1/aniloop_profiles?'+urlencode({'id':'eq.'+subject,'select':'id,username,created_at'}),token=access)
        if not rows or rows[0]['id']!=subject:raise APIError('Could not load your Supabase profile.',502)
        profile=rows[0]
        with self.community.db() as db:
            db.execute('BEGIN IMMEDIATE')
            row=db.execute('SELECT u.id,u.username FROM users u JOIN supabase_identities i ON u.id=i.user_id WHERE i.subject=?',(subject,)).fetchone()
            if row:
                if row['username']!=profile['username']:raise APIError('Your cloud username changed. Contact the operator to reconcile the local game profile.',409)
                user_id=row['id']
            else:
                if db.execute('SELECT 1 FROM users WHERE username=?',(profile['username'],)).fetchone():raise APIError('That name belongs to a different local account. Accounts are never merged automatically.',409)
                # A random unusable local password: cloud credentials are never copied.
                encoded='scrypt$'+'00'*16+'$'+secrets.token_hex(64)
                user_id=db.execute('INSERT INTO users(username,password,created) VALUES(?,?,?)',(profile['username'],encoded,int(time.time()))).lastrowid
                db.execute('INSERT INTO supabase_identities VALUES(?,?)',(subject,user_id))
        return {'id':user_id,'username':profile['username'],'provider':'supabase','cloudId':subject,'email':remote.get('email','')}
    def _establish(self,session,adult=True):
        access=session.get('access_token');refresh=session.get('refresh_token')
        if not access or not refresh:raise APIError('Supabase did not issue a session.',502)
        remote=self.request('/auth/v1/user',token=access)
        if not remote.get('email_confirmed_at'):raise APIError('Confirm your email before signing in.',403)
        user=self._profile(access,remote,adult)
        token='sb.'+secrets.token_urlsafe(32)
        now=time.time()
        with self.lock:
            for key in [key for key,value in self.sessions.items() if value['until']<=now]:del self.sessions[key]
            if len(self.sessions)>=10000:raise APIError('Too many active cloud sessions. Try later.',503)
            self.sessions[self._key(token)]={'access':access,'refresh':refresh,'expires':now+max(0,int(session.get('expires_in',3600))),'until':now+30*86400,'checked':now,'user':user}
            self.store.save(self._key(token),self.sessions[self._key(token)])
        return user,token
    def auth(self,data,register,ip):
        self.community.throttle('supabase:'+ip)
        email=data.get('email');password=data.get('password')
        if not isinstance(email,str) or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',email) or len(email)>254:raise APIError('Enter a valid email address.')
        if not isinstance(password,str) or not 12<=len(password)<=128:raise APIError('Use a password with 12–128 characters.')
        if data.get('adultConfirmed') is not True:raise APIError('Confirm that you are 18 or older.')
        if register:
            name=data.get('username')
            if not isinstance(name,str) or not re.fullmatch(r'[A-Za-z0-9_-]{3,24}',name):raise APIError('Use a username with 3–24 letters, digits, underscores or hyphens.')
            with self.community.db() as db:
                if db.execute('SELECT 1 FROM users WHERE username=?',(name,)).fetchone():raise APIError('That name is reserved by an existing local account. Choose another public username.',409)
            path='/auth/v1/signup'
            if self.origin:path+='?'+urlencode({'redirect_to':self.origin+'/'})
            # Confirmation marks the email verified; password login is deliberately separate.
            # PKCE prevents Supabase from returning access/refresh JWTs in the URL.
            challenge=base64.urlsafe_b64encode(hashlib.sha256(secrets.token_bytes(64)).digest()).rstrip(b'=').decode()
            session=self.request(path,{'email':email,'password':password,'data':{'username':name},'code_challenge':challenge,'code_challenge_method':'s256'})
            if not session.get('access_token'):return None,None
        else:session=self.request('/auth/v1/token?grant_type=password',{'email':email,'password':password})
        return self._establish(session,data.get('adultConfirmed'))
    def user(self,token):
        if not self.cloud_token(token):return None
        with self.lock:
            key=self._key(token);session=self.sessions.get(key);now=time.time()
            if not self.store.active(key):self.sessions.pop(key,None);self.store.delete(key);return None
            if not session:
                session=self.store.load(key)
                if not session:return None
                self.sessions[key]=session
            if session['until']<=now:self.sessions.pop(key,None);self.store.delete(key);return None
            try:
                if session['expires']<=now+60:
                    fresh=self.request('/auth/v1/token?grant_type=refresh_token',{'refresh_token':session['refresh']})
                    session.update(access=fresh['access_token'],refresh=fresh['refresh_token'],expires=now+int(fresh.get('expires_in',3600)),checked=0)
                    self.store.save(key,session)
                if now-session['checked']>=60:
                    remote=self.request('/auth/v1/user',token=session['access'])
                    if str(remote.get('id'))!=session['user']['cloudId']:raise APIError('Session identity changed.',401)
                    session['checked']=now
            except APIError as error:
                if error.status in {400,401,403}:self.sessions.pop(key,None);self.store.delete(key);return None
                raise
            return dict(session['user'])
    def logout(self,token):
        with self.lock:
            key=self._key(token);session=self.sessions.pop(key,None) or self.store.load(key)
            self.store.delete(key)
        if session:
            try:self.request('/auth/v1/logout?scope=local',{},session['access'])
            except APIError:pass # Local cookie/session is always revoked, even during outage.
    def export(self,user,token):
        result=self.community.export(user)
        with self.lock:session=self.sessions.get(self._key(token))
        if not session:raise APIError('Sign in to continue.',401)
        result['cloud']=self.request('/rest/v1/rpc/aniloop_export_own_account',{},session['access'])
        return result
    def delete(self,user,password,token):
        if not isinstance(password,str) or not 12<=len(password)<=128:raise APIError('Enter your current password.')
        fresh=self.request('/auth/v1/token?grant_type=password',{'email':user['email'],'password':password})
        remote=self.request('/auth/v1/user',token=fresh.get('access_token'))
        if str(remote.get('id'))!=user['cloudId']:raise APIError('Account identity mismatch.',403)
        self.request('/rest/v1/rpc/aniloop_delete_own_account',{},fresh['access_token'])
        # Cloud deletion succeeded; scrub local room payloads and dependent game rows.
        with self.community.db() as db:
            tables={r['name'] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            if 'rooms' in tables:
                for room in db.execute('SELECT code,state FROM rooms').fetchall():
                    state=json.loads(room['state']);state.get('players',{}).pop(str(user['id']),None)
                    db.execute('UPDATE rooms SET state=?,revision=revision+1 WHERE code=?',(json.dumps(state),room['code']))
            db.execute('DELETE FROM users WHERE id=?',(user['id'],))
        with self.lock:
            for key in [key for key,value in self.sessions.items() if value['user']['cloudId']==user['cloudId']]:del self.sessions[key]

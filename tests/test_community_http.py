import json,tempfile,threading,unittest,urllib.request,urllib.error
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from server import Handler
from community import Community
ROOT=Path(__file__).resolve().parents[1]
class QuietHandler(Handler):
    def log_message(self,*args):pass
class AccountHTTPTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp=tempfile.TemporaryDirectory();cls.server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(ROOT)))
        from hint_media import HintMedia
        from media_cache import MediaCache
        cls.server.hint_media=HintMedia(ROOT,MediaCache(ROOT))
        cls.server.community=Community(ROOT,Path(cls.temp.name)/'accounts.sqlite3')
        from friends import Friends
        cls.server.friends=Friends(cls.server.community)
        cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True);cls.thread.start();cls.url=f'http://127.0.0.1:{cls.server.server_port}'
    @classmethod
    def tearDownClass(cls):cls.server.shutdown();cls.server.server_close();cls.thread.join();cls.temp.cleanup()
    def request(self,path,payload=None,headers=None):
        data=json.dumps(payload).encode() if payload is not None else None
        h={'Content-Type':'application/json',**(headers or {})}
        request=urllib.request.Request(self.url+path,data=data,headers=h)
        try:response=urllib.request.urlopen(request)
        except urllib.error.HTTPError as error:response=error
        with response:return response.status,dict(response.headers),response.read()
    def test_account_config_has_no_keys_and_reports_local_mode(self):
        status,_,body=self.request('/api/config');self.assertEqual(status,200)
        self.assertEqual(json.loads(body),{'supabaseEnabled':False,'defaultAuthProvider':'local','gameDataStorage':'local-backend'})

    def test_private_project_files_and_directory_lists_are_blocked(self):
        for path in ['/community.py','/server.py','/.runtime/community.sqlite3','/data/','/assets/','/tests/test_community.py']:
            self.assertEqual(self.request(path)[0],404,path)
    def test_registration_requires_explicit_adult_declaration(self):
        payload={'username':'Adult_Test','password':'a long enough test password'}
        self.assertEqual(self.request('/api/register',payload)[0],400)
        for value in [False,'true',18,None]:
            self.assertEqual(self.request('/api/register',{**payload,'adultConfirmed':value})[0],400)
        self.assertEqual(self.request('/api/register',{**payload,'adultConfirmed':True})[0],200)

    def test_origins_authentication_and_cookie_flags(self):
        payload={'adultConfirmed':True,'username':'Browser_Player','password':'a long enough test password'}
        self.assertEqual(self.request('/api/register',payload,{'Origin':'https://attacker.invalid'})[0],403)
        status,headers,body=self.request('/api/register',payload,{'Origin':self.url});self.assertEqual(status,200)
        cookie=headers['Set-Cookie'];self.assertIn('HttpOnly',cookie);self.assertIn('SameSite=Lax',cookie);self.assertIn('no-store',headers['Cache-Control'])
        token=cookie.split(';')[0];status,_,body=self.request('/api/account',headers={'Cookie':token});self.assertEqual(json.loads(body)['user']['username'],'Browser_Player')
        self.assertEqual(self.request('/api/scores',{'round':{}})[0],401)
        self.assertEqual(self.request('/api/logout',{}, {'Cookie':token})[0],200)
        _,_,body=self.request('/api/account',headers={'Cookie':token});self.assertIsNone(json.loads(body)['user'])
    def test_compressed_catalog_revalidates_without_retransfer(self):
        import gzip
        status,headers,body=self.request('/data/pool.json',headers={'Accept-Encoding':'gzip'})
        self.assertEqual(status,200);self.assertEqual(headers['Content-Encoding'],'gzip')
        raw=(ROOT/'data/pool.json').read_bytes()
        self.assertEqual(gzip.decompress(body),raw);self.assertLess(len(body),len(raw)//2)
        status,again,body=self.request('/data/pool.json',headers={'Accept-Encoding':'gzip','If-None-Match':headers['ETag']})
        self.assertEqual(status,304);self.assertEqual(body,b'');self.assertEqual(again['Vary'],'Accept-Encoding')
        status,headers,body=self.request('/catalog.js',headers={'Accept-Encoding':'gzip;q=0'})
        self.assertEqual(status,200);self.assertNotIn('Content-Encoding',headers)
        self.assertEqual(body,(ROOT/'catalog.js').read_bytes())
    def test_failed_media_is_not_cached_as_immutable(self):
        status,headers,_=self.request('/hints/not-real.mp4')
        self.assertNotIn('immutable',headers.get('Cache-Control',''))
    def test_friend_api_requires_auth_same_origin_and_returns_only_mutual_players(self):
        self.assertEqual(self.request('/api/friends')[0],401)
        self.assertEqual(self.request('/api/friends/request',{'adultConfirmed':True,'username':'Someone'})[0],401)
        def register(name):
            status,headers,body=self.request('/api/register',{'adultConfirmed':True,'username':name,'password':'Friends HTTP test password!'});self.assertEqual(status,200)
            return headers['Set-Cookie'].split(';')[0],json.loads(body)['user']['id']
        alice,alice_id=register('HttpFriendAlice');bob,bob_id=register('HttpFriendBob')
        payload={'adultConfirmed':True,'username':'HttpFriendBob'}
        self.assertEqual(self.request('/api/friends/request',payload,{'Cookie':alice,'Origin':'https://attacker.invalid'})[0],403)
        self.assertEqual(self.request('/api/friends/request',payload,{'Cookie':alice})[0],200)
        status,headers,body=self.request('/api/friends',headers={'Cookie':alice});self.assertEqual(status,200);self.assertEqual(json.loads(body)['friendCount'],0);self.assertEqual(headers['Cache-Control'],'no-store')
        self.assertEqual(self.request('/api/friends/accept',{'userId':bob_id},{'Cookie':alice})[0],403)
        self.assertEqual(self.request('/api/friends/accept',{'userId':alice_id},{'Cookie':bob})[0],200)
        status,_,body=self.request('/api/friends',headers={'Cookie':alice});self.assertEqual(json.loads(body)['friendCount'],1)
    def test_admin_is_checked_on_server_and_rechecked_after_revocation(self):
        self.assertEqual(self.request('/admin.html')[0],200)
        self.assertEqual(self.request('/api/admin')[0],401)
        status,headers,body=self.request('/api/register',{'adultConfirmed':True,'username':'HttpAdminTest','password':'Administration test password!'})
        self.assertEqual(status,200);token=headers['Set-Cookie'].split(';')[0];user_id=json.loads(body)['user']['id']
        self.assertEqual(self.request('/api/admin',headers={'Cookie':token})[0],403)
        with self.server.community.db() as db:db.execute("INSERT INTO account_roles VALUES(?,'admin')",(user_id,))
        status,headers,body=self.request('/api/admin',headers={'Cookie':token});self.assertEqual(status,200);self.assertEqual(headers['Cache-Control'],'no-store')
        self.assertNotIn('password',body.decode());self.assertNotIn('token',body.decode())
        status,_,body=self.request('/api/account',headers={'Cookie':token});self.assertTrue(json.loads(body)['user']['isAdmin'])
        with self.server.community.db() as db:db.execute('DELETE FROM account_roles WHERE user_id=?',(user_id,))
        self.assertEqual(self.request('/api/admin',headers={'Cookie':token})[0],403)
    def test_profile_pictures_private_and_admin_writes_protected(self):
        from rewards import Rewards
        from test_profile_images import data_url,png
        Rewards(self.server.community)
        def register(name):
            status,h,b=self.request('/api/register',{'adultConfirmed':True,'username':name,'password':'Picture and admin test pass!'})
            self.assertEqual(status,200);return h['Set-Cookie'].split(';')[0],json.loads(b)['user']['id']
        owner,uid=register('PictureHttpOwner');other,_=register('PictureHttpOther')
        payload={'image':data_url(png())}
        self.assertEqual(self.request('/api/account/picture',payload)[0],401)
        self.assertEqual(self.request('/api/account/picture')[0],401)
        self.assertEqual(self.request('/api/account/picture',payload,{'Cookie':owner,'Origin':'https://evil.example'})[0],403)
        self.assertEqual(self.request('/api/account/picture',payload,{'Cookie':owner})[0],200)
        status,h,b=self.request('/api/account/picture',headers={'Cookie':owner});self.assertEqual(status,200);self.assertEqual(b,png());self.assertEqual(h['Content-Type'],'image/png');self.assertEqual(h['Cache-Control'],'no-store')
        self.assertEqual(self.request('/api/account/picture?userId='+str(uid),headers={'Cookie':other})[0],404)
        self.assertTrue(json.loads(self.request('/api/account',headers={'Cookie':owner})[2])['user']['hasPicture'])
        action={'action':'set-shards','userId':uid,'shards':12}
        self.assertEqual(self.request('/api/admin/action',action,{'Cookie':other})[0],403)
        with self.server.community.db() as db:db.execute("INSERT INTO account_roles VALUES(?,'admin')",(uid,))
        self.assertEqual(self.request('/api/admin/action',action,{'Cookie':owner,'Origin':'https://evil.example'})[0],403)
        self.assertEqual(self.request('/api/admin/action',action,{'Cookie':owner})[0],200)
        self.assertEqual(self.request('/api/account/picture',{'image':None},{'Cookie':owner})[0],200)
        self.assertEqual(self.request('/api/account/picture',headers={'Cookie':owner})[0],404)

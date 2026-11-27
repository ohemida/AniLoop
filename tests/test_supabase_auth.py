import os,tempfile,unittest,uuid,time
from pathlib import Path
from community import Community,APIError
from supabase_auth import SupabaseAuth
ROOT=Path(__file__).resolve().parents[1]
SUBJECT='00000000-0000-0000-0000-000000000001'

class FakeSupabase:
    def __init__(self):self.profile=None;self.confirm=True;self.deleted=False;self.calls=[];self.outage=False;self.missing_actions=False
    def __call__(self,path,payload=None,token=None,method=None):
        self.calls.append((path,payload,token))
        if self.outage:raise APIError('Unavailable',503)
        remote={'id':SUBJECT,'email':'qa@example.test','email_confirmed_at':'2026-11-24T00:00:00Z','user_metadata':{'username':'CloudPlayer'}}
        session={'access_token':'access-private','refresh_token':'refresh-private','expires_in':3600}
        if path.startswith('/auth/v1/signup'):return {'user':remote} if self.confirm else session
        if path.startswith('/auth/v1/token?grant_type=password'):
            if payload['password']!='Cloud private password!':raise APIError('Invalid credentials',401)
            return session
        if path.startswith('/auth/v1/token?grant_type=refresh_token'):return {**session,'access_token':'refreshed-private'}
        if path=='/auth/v1/user':
            if self.deleted:raise APIError('Deleted user',401)
            return remote
        if path.startswith('/rest/v1/aniloop_profiles?'):return [self.profile] if self.profile else []
        if path=='/rest/v1/rpc/aniloop_create_profile':
            self.profile={'id':SUBJECT,'username':payload['p_username'],'created_at':'2026-11-24'};return {}
        if path=='/rest/v1/rpc/aniloop_export_own_account':
            if self.missing_actions:raise APIError('Install account_actions.sql',503)
            return {'account':{'id':SUBJECT,'email':remote['email']},'profile':self.profile,'scores':[]}
        if path=='/rest/v1/rpc/aniloop_delete_own_account':
            if self.missing_actions:raise APIError('Install account_actions.sql',503)
            self.deleted=True;return {}
        if path.startswith('/auth/v1/logout'):return {}
        raise AssertionError(path)

class SupabaseAuthTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.community=Community(ROOT,Path(self.temp.name)/'accounts.sqlite3');self.remote=FakeSupabase()
        self.auth=SupabaseAuth(self.community,'https://example.supabase.co','sb_publishable_test',request=self.remote)
        self.payload={'username':'CloudPlayer','email':'qa@example.test','password':'Cloud private password!','adultConfirmed':True}
    def tearDown(self):self.temp.cleanup()
    def login(self):return self.auth.auth(self.payload,False,'qa')
    def test_pending_verification_creates_no_local_shadow_or_session(self):
        self.assertEqual(self.auth.auth(self.payload,True,'qa'),(None,None))
        with self.community.db() as db:self.assertEqual(db.execute('SELECT count(*) FROM users').fetchone()[0],0)
        self.assertEqual(self.auth.sessions,{})
        request=self.remote.calls[0][1];self.assertEqual(request['code_challenge_method'],'s256');self.assertEqual(len(request['code_challenge']),43)
    def test_login_uses_verified_identity_and_keeps_tokens_out_of_sqlite(self):
        user,token=self.login();self.assertEqual(user['provider'],'supabase');self.assertTrue(token.startswith('sb.'))
        self.assertEqual(self.auth.user(token)['id'],user['id']);self.assertIsNone(self.community.user(token))
        with self.community.db() as db:
            text='\n'.join(db.iterdump());self.assertNotIn('access-private',text);self.assertNotIn('refresh-private',text);self.assertNotIn('Cloud private password!',text)
            self.assertEqual(db.execute('SELECT subject FROM supabase_identities').fetchone()[0],SUBJECT)
        again,_=self.login();self.assertEqual(again['id'],user['id'])
    def test_existing_local_account_is_never_merged_or_overwritten(self):
        local,_=self.community.auth({'username':'CloudPlayer','password':'Local private password!'},True,'qa')
        with self.assertRaises(APIError):self.login()
        with self.community.db() as db:self.assertEqual(db.execute('SELECT count(*) FROM users').fetchone()[0],1)
        self.assertEqual(self.community.auth({'username':'CloudPlayer','password':'Local private password!'},False,'qa')[0]['id'],local['id'])
    def test_age_validation_refresh_logout_and_restart(self):
        with self.assertRaises(APIError):self.auth.auth({**self.payload,'adultConfirmed':False},False,'qa')
        user,token=self.login();self.auth.sessions[self.auth._key(token)]['expires']=0
        self.assertEqual(self.auth.user(token)['id'],user['id'])
        self.assertTrue(any('refresh_token' in call[0] for call in self.remote.calls))
        fresh=SupabaseAuth(self.community,'https://example.supabase.co','sb_publishable_test',request=self.remote)
        self.assertEqual(fresh.user(token)['id'],user['id'])
        self.remote.outage=True;self.auth.logout(token);self.assertIsNone(self.auth.user(token));self.assertIsNone(fresh.user(token))
    def test_remote_deletion_revokes_cached_session_when_rechecked(self):
        _,token=self.login();self.remote.deleted=True;self.auth.sessions[self.auth._key(token)]['checked']=0
        self.assertIsNone(self.auth.user(token))
    def test_export_and_password_confirmed_deletion_preserve_other_accounts(self):
        other,_=self.community.auth({'username':'OtherLocal','password':'Other private password!'},True,'qa')
        user,token=self.login();result=self.auth.export(user,token)
        self.assertEqual(result['cloud']['account']['id'],SUBJECT)
        self.assertNotIn('access-private',str(result))
        with self.assertRaises(APIError):self.auth.delete(user,'Wrong private password!',token)
        self.assertFalse(self.remote.deleted)
        self.remote.missing_actions=True
        with self.assertRaises(APIError):self.auth.delete(user,self.payload['password'],token)
        with self.community.db() as db:self.assertIsNotNone(db.execute('SELECT id FROM users WHERE id=?',(user['id'],)).fetchone())
        self.remote.missing_actions=False;self.auth.delete(user,self.payload['password'],token)
        self.assertTrue(self.remote.deleted);self.assertIsNone(self.auth.user(token))
        with self.community.db() as db:
            self.assertIsNone(db.execute('SELECT id FROM users WHERE id=?',(user['id'],)).fetchone())
            self.assertIsNotNone(db.execute('SELECT id FROM users WHERE id=?',(other['id'],)).fetchone())
    def test_database_cannot_switch_to_another_project(self):
        with self.assertRaises(ValueError):SupabaseAuth(self.community,'https://another.supabase.co','sb_publishable_test')

    def test_project_config_rejects_http_paths_and_secret_keys(self):
        for url in ['http://example.supabase.co','https://example.supabase.co/rest/v1/','https://evil.example','https://x.supabase.co?key=oops']:
            with self.assertRaises(ValueError):SupabaseAuth(self.community,url,'sb_publishable_test')
        with self.assertRaises(ValueError):SupabaseAuth(self.community,'https://example.supabase.co','sb_secret_never')

    def test_persisted_refresh_expiry_and_ciphertext_binding(self):
        user,token=self.login();key=self.auth._key(token)
        self.auth.sessions[key]['expires']=0;self.auth.user(token)
        fresh=SupabaseAuth(self.community,'https://example.supabase.co','sb_publishable_test',request=self.remote)
        self.assertEqual(fresh.user(token)['id'],user['id'])
        self.assertEqual(fresh.sessions[key]['access'],'refreshed-private')
        if os.name!='nt':self.assertEqual(self.community.path.with_name(self.community.path.name+'.session-key').stat().st_mode&0o777,0o600)
        # Tampering with encrypted tokens fails closed and removes the affected session.
        with self.community.db() as db:db.execute('UPDATE supabase_sessions SET sealed=? WHERE token_hash=?',(b'tampered',key))
        again=SupabaseAuth(self.community,'https://example.supabase.co','sb_publishable_test',request=self.remote)
        self.assertIsNone(again.user(token))
        _,token=self.login();key=self.auth._key(token)
        with self.community.db() as db:db.execute('UPDATE supabase_sessions SET expires=0 WHERE token_hash=?',(key,))
        self.assertIsNone(self.auth.user(token))
    def test_session_payload_cannot_be_reused_under_another_cookie_hash(self):
        _,token=self.login();key=self.auth._key(token);other=self.auth._key('sb.another-cookie')
        with self.community.db() as db:
            row=db.execute('SELECT user_id,sealed,expires FROM supabase_sessions WHERE token_hash=?',(key,)).fetchone()
            db.execute('INSERT INTO supabase_sessions VALUES(?,?,?,?)',(other,*row))
        fresh=SupabaseAuth(self.community,'https://example.supabase.co','sb_publishable_test',request=self.remote)
        self.assertIsNone(fresh.user('sb.another-cookie'));self.assertIsNotNone(fresh.user(token))

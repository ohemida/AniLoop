"""Encrypted cloud sessions, bound to the hashed cookie and Supabase project."""
import json,os,stat,time

class SessionStore:
    def __init__(self,community,project):
        try:
            from cryptography.fernet import Fernet,InvalidToken
        except ImportError:
            raise RuntimeError('Install requirements.txt to enable persistent Supabase sign-in.')
        self.community=community;self.project=project;self.invalid=InvalidToken
        path=community.path.with_name(community.path.name+'.session-key')
        flags=os.O_NOFOLLOW if hasattr(os,'O_NOFOLLOW') else 0
        try:
            fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|flags,0o600)
        except FileExistsError:pass
        else:
            with os.fdopen(fd,'wb') as f:f.write(Fernet.generate_key());f.flush();os.fsync(f.fileno())
        fd=os.open(path,os.O_RDONLY|flags)
        with os.fdopen(fd,'rb') as f:
            if not stat.S_ISREG(os.fstat(f.fileno()).st_mode):raise RuntimeError('Session key must be a regular private file.')
            os.fchmod(f.fileno(),0o600);key=f.read(128)
        self.cipher=Fernet(key)
        with community.db() as db:
            db.execute('CREATE TABLE IF NOT EXISTS supabase_sessions(token_hash TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,sealed BLOB NOT NULL,expires REAL NOT NULL)')
            db.execute('DELETE FROM supabase_sessions WHERE expires<=?',(time.time(),))
    def save(self,key,session):
        payload={'cookieHash':key,'project':self.project,'session':session}
        sealed=self.cipher.encrypt(json.dumps(payload,separators=(',',':')).encode())
        with self.community.db() as db:
            db.execute('DELETE FROM supabase_sessions WHERE expires<=?',(time.time(),))
            if not db.execute('SELECT 1 FROM supabase_sessions WHERE token_hash=?',(key,)).fetchone() and db.execute('SELECT COUNT(*) FROM supabase_sessions').fetchone()[0]>=10000:
                raise RuntimeError('Too many active cloud sessions.')
            db.execute('INSERT INTO supabase_sessions VALUES(?,?,?,?) ON CONFLICT(token_hash) DO UPDATE SET sealed=excluded.sealed,expires=excluded.expires',(key,session['user']['id'],sealed,session['until']))
    def active(self,key):
        with self.community.db() as db:return bool(db.execute('SELECT 1 FROM supabase_sessions WHERE token_hash=? AND expires>?',(key,time.time())).fetchone())
    def load(self,key):
        with self.community.db() as db:row=db.execute('SELECT * FROM supabase_sessions WHERE token_hash=?',(key,)).fetchone()
        if not row:return None
        try:
            payload=json.loads(self.cipher.decrypt(row['sealed']))
            session=payload['session']
            if payload['cookieHash']!=key or payload['project']!=self.project or session['user']['id']!=row['user_id'] or session['until']<=time.time() or row['expires']!=session['until']:raise ValueError()
            # Revalidate identity online after a process restart.
            session['checked']=0
            return session
        except (self.invalid,ValueError,TypeError,KeyError):
            self.delete(key);return None
    def delete(self,key):
        with self.community.db() as db:db.execute('DELETE FROM supabase_sessions WHERE token_hash=?',(key,))

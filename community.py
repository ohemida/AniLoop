"""SQLite accounts and community scores. No third-party Python dependencies."""
import hashlib,hmac,json,re,secrets,sqlite3,threading,time,unicodedata
from pathlib import Path
from collections import defaultdict,deque
from contextlib import contextmanager

class APIError(Exception):
    def __init__(self,message,status=400):self.message=message;self.status=status

class Community:
    def __init__(self,root,database=None):
        self.root=Path(root);self.path=Path(database) if database else self.root/'.runtime/community.sqlite3'
        self.path.parent.mkdir(parents=True,exist_ok=True)
        self.guard=threading.Lock();self.attempts=defaultdict(deque);self.hash_slots=threading.Semaphore(2)
        self.catalog={a['id']:a for a in json.loads((self.root/'data/pool.json').read_text())['anime']}
        self.pack_key=json.loads((self.root/'data/pool.json').read_text())['key']
        with self.db() as db:
            db.executescript('''
            CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,username TEXT NOT NULL COLLATE NOCASE UNIQUE,password TEXT NOT NULL,created INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS scores(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,mode TEXT NOT NULL,seed TEXT NOT NULL,score INTEGER NOT NULL CHECK(score BETWEEN 0 AND 100000),breakdown TEXT NOT NULL,created INTEGER NOT NULL,UNIQUE(user_id,mode,seed));
            CREATE INDEX IF NOT EXISTS scores_ranking ON scores(mode,created,score);
            ''')
    @contextmanager
    def db(self):
        db=sqlite3.connect(self.path,timeout=15);db.row_factory=sqlite3.Row;db.execute('PRAGMA foreign_keys=ON')
        try:
            with db:yield db
        finally:db.close()
    def throttle(self,ip):
        now=time.time()
        with self.guard:
            # Bound the limiter even when many clients use different addresses.
            for key in list(self.attempts):
                if not self.attempts[key] or self.attempts[key][-1]<now-600:del self.attempts[key]
            if len(self.attempts)>10000:raise APIError('Too many requests. Try again later.',429)
            attempts=self.attempts[ip]
            while attempts and attempts[0]<now-600:attempts.popleft()
            if len(attempts)>=15:raise APIError('Too many sign-in attempts. Try again in ten minutes.',429)
            attempts.append(now)
    def hash_password(self,password,salt=None):
        salt=salt or secrets.token_hex(16)
        with self.hash_slots:
            digest=hashlib.scrypt(password.encode(),salt=bytes.fromhex(salt),n=32768,r=8,p=3,maxmem=64*1024**2).hex()
        return f'scrypt${salt}${digest}'
    def check_password(self,password,encoded):
        _,salt,_=encoded.split('$');return hmac.compare_digest(self.hash_password(password,salt),encoded)
    def credentials(self,data):
        username=data.get('username','');password=data.get('password','')
        if not isinstance(username,str) or not re.fullmatch(r'[A-Za-z0-9_\-]{3,24}',username):raise APIError('Use 3–24 letters, numbers, underscores, or hyphens for your username.')
        if not isinstance(password,str) or not 12<=len(password)<=128:raise APIError('Use a password between 12 and 128 characters.')
        return username,password
    def auth(self,data,register,ip):
        self.throttle(ip);username,password=self.credentials(data)
        with self.db() as db:
            if register:
                encoded=self.hash_password(password)
                try:user_id=db.execute('INSERT INTO users(username,password,created) VALUES(?,?,?)',(username,encoded,int(time.time()))).lastrowid
                except sqlite3.IntegrityError:raise APIError('That username is already taken.',409)
            else:
                row=db.execute('SELECT * FROM users WHERE username=?',(username,)).fetchone()
                # Same password work for missing usernames to reduce timing differences.
                encoded=row['password'] if row else 'scrypt$'+'00'*16+'$'+'00'*64
                valid=self.check_password(password,encoded)
                if not row or not valid:raise APIError('Incorrect username or password.',401)
                user_id=row['id'];username=row['username']
            token=secrets.token_urlsafe(32)
            db.execute('DELETE FROM sessions WHERE expires<?',(int(time.time()),))
            db.execute('INSERT INTO sessions VALUES(?,?,?)',(hashlib.sha256(token.encode()).hexdigest(),user_id,int(time.time())+30*86400))
        return {'id':user_id,'username':username},token
    def user(self,token):
        if not token:return None
        with self.db() as db:
            row=db.execute('SELECT u.id,u.username,u.created FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>?',(hashlib.sha256(token.encode()).hexdigest(),int(time.time()))).fetchone()
            return dict(row) if row else None
    def logout(self,token):
        with self.db() as db:db.execute('DELETE FROM sessions WHERE token=?',(hashlib.sha256(token.encode()).hexdigest(),))
    def delete(self,user,password):
        if not isinstance(password,str) or not 12<=len(password)<=128:raise APIError('Enter your current password.')
        with self.db() as db:
            row=db.execute('SELECT password FROM users WHERE id=?',(user['id'],)).fetchone()
            if not row or not self.check_password(password,row['password']):raise APIError('Incorrect password.',401)
            db.execute('DELETE FROM users WHERE id=?',(user['id'],))
    @staticmethod
    def normalize(value):
        return ''.join(c for c in unicodedata.normalize('NFKD',str(value or '')).lower() if c.isalnum())
    def match(self,value,options):
        needle=self.normalize(value);return bool(needle) and any(needle==self.normalize(v) for v in options)
    def title_match(self,value,anime):return self.match(value,[anime['title'],*anime.get('aliases',[])])
    def recalculate(self,run):
        if not isinstance(run,dict) or run.get('packKey')!=self.pack_key:raise APIError('Only complete rounds from the default pool can enter the leaderboard.')
        mode=run.get('mode');seed=run.get('seed')
        if mode not in {'daily','infinity'} or not isinstance(seed,str) or not 1<=len(seed)<=200:raise APIError('Invalid round identity.')
        if mode=='daily':
            # One result per user per UTC date. The game itself still resets at local midnight.
            prefix=seed.split(':')[0]
            from datetime import date
            try:day=date.fromisoformat(prefix)
            except ValueError:raise APIError('Invalid daily round date.')
            if abs((date.today()-day).days)>1:raise APIError('Only the current daily quiz can be submitted.')
            seed=prefix
        breakdown={}
        try:
            for category in ['screenshot','character','opening','ending','anidle']:
                game=run['games'][category];count=1 if category=='anidle' else 3
                if game.get('done') is not True or len(game['questions'])!=count or len(game['answers'])!=count:raise ValueError()
                total=0
                for i,answer in enumerate(game['answers']):
                    if not isinstance(answer,dict):raise ValueError()
                    if category=='character':
                        questions=game['questions'][i];refs=game['characterRefs'][i];entries=answer['entries']
                        if len(questions)!=4 or len(refs)!=4 or len(entries)!=4:raise ValueError()
                        for anime_id,ref,entry in zip(questions,refs,entries):
                            anime=self.catalog[anime_id];character=next(c for c in anime['characters'] if c['id']==ref)
                            total+=2000 if self.match(entry.get('characterValue'),[character['name'],*character.get('aliases',[])]) else 0
                            total+=500 if self.title_match(entry.get('animeValue'),anime) else 0
                    else:
                        anime=self.catalog[game['questions'][i]]
                        if category in {'opening','ending'} and not anime.get(category):raise ValueError()
                        if category=='screenshot' and not anime.get('screenshots'):raise ValueError()
                        if category=='anidle':
                            attempt=answer['attempt']
                            if type(attempt)!=int or not 1<=attempt<=22:raise ValueError()
                            guesses=game.get('guesses',[])
                            if len(guesses)>attempt or any(type(g.get('attempt'))!=int or not 1<=g['attempt']<=attempt for g in guesses):raise ValueError()
                            correct=self.title_match(answer.get('value'),anime)
                            if correct and (not guesses or guesses[-1]['id']!=anime['id'] or guesses[-1]['attempt']!=attempt):raise ValueError()
                            total+=max(0,10000-max(0,attempt-3)*500) if correct else 0
                        else:
                            hints=answer['hints']
                            if not isinstance(hints,list) or any(type(n)!=int for n in hints) or hints not in ([[],[1],[1,2],[1,2,3]] if category=='screenshot' else [[],[1]]):raise ValueError()
                            total+=max(0,(10000 if category=='screenshot' else 5000)-2500*len(hints)) if self.title_match(answer.get('value'),anime) else 0
                breakdown[category]=total
        except (KeyError,TypeError,ValueError,StopIteration,IndexError):raise APIError('This round is incomplete or uses an older save format. Complete a new round before submitting.')
        score=sum(breakdown.values())
        if not 0<=score<=100000:raise APIError('Invalid score.')
        return mode,seed,score,breakdown
    def submit(self,user,run):
        mode,seed,score,breakdown=self.recalculate(run)
        with self.db() as db:
            try:db.execute('INSERT INTO scores(user_id,mode,seed,score,breakdown,created) VALUES(?,?,?,?,?,?)',(user['id'],mode,seed,score,json.dumps(breakdown),int(time.time())))
            except sqlite3.IntegrityError:raise APIError('You have already submitted this round.',409)
        return {'score':score,'breakdown':breakdown}
    def leaderboard(self,mode='infinity',period='all'):
        if mode not in {'infinity','daily'} or period not in {'all','week','today'}:raise APIError('Invalid leaderboard filter.')
        now=int(time.time());since=0 if period=='all' else now-7*86400 if period=='week' else now-now%86400
        with self.db() as db:
            rows=db.execute('SELECT u.id,u.username,MAX(s.score) AS score,COUNT(*) AS rounds,MIN(s.created) AS first_result FROM scores s JOIN users u ON u.id=s.user_id WHERE s.mode=? AND s.created>=? GROUP BY u.id ORDER BY score DESC,rounds DESC,first_result ASC,u.username COLLATE NOCASE ASC LIMIT 100',(mode,since)).fetchall()
        return {'mode':mode,'period':period,'entries':[{'rank':i+1,'userId':r['id'],'username':r['username'],'score':r['score'],'rounds':r['rounds']} for i,r in enumerate(rows)]}

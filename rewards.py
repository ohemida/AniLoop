"""Once-per-day completion rewards, streak history and cosmetic-only purchases."""
import time
from datetime import datetime,timedelta,timezone,date
from community import APIError
COSMETICS=[{'id':'silver','name':'Silver lining','description':'A quiet silver profile border.','price':250},{'id':'orbit','name':'Mauve orbit','description':'A double mauve ring for your profile.','price':500},{'id':'starlit','name':'Starlit loop','description':'A star-trimmed profile frame.','price':1000},{'id':'fern','name':'Night bloom','description':'Sage corners for a quieter profile.','price':450},{'id':'ink','name':'Ink panel','description':'A sharp frame inspired by manga panels.','price':750},{'id':'lunar','name':'Lunar arc','description':'A crescent that follows your next loop.','price':1250}]
class Rewards:
    def __init__(self,community):
        self.community=community
        with community.db() as db:
            db.executescript('''CREATE TABLE IF NOT EXISTS daily_claims(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,day TEXT NOT NULL,seed TEXT NOT NULL,amount INTEGER NOT NULL,score INTEGER NOT NULL,created INTEGER NOT NULL,PRIMARY KEY(user_id,day),UNIQUE(user_id,seed));
            CREATE TABLE IF NOT EXISTS wallets(user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,shards INTEGER NOT NULL DEFAULT 0 CHECK(shards>=0),equipped TEXT NOT NULL DEFAULT 'classic');
            CREATE TABLE IF NOT EXISTS cosmetics(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,item TEXT NOT NULL,PRIMARY KEY(user_id,item));''')
    def today(self):return datetime.now(timezone.utc).date()
    def summary(self,db,user):
        today=self.today();rows=[dict(r) for r in db.execute('SELECT day,amount,score FROM daily_claims WHERE user_id=? ORDER BY day',(user['id'],))]
        best=0;chain=0;previous=None
        for row in rows:
            day=date.fromisoformat(row['day']);chain=chain+1 if previous and day==previous+timedelta(days=1) else 1;best=max(best,chain);previous=day
        current=chain if previous and previous>=today-timedelta(days=1) else 0
        wallet=db.execute('SELECT shards,equipped FROM wallets WHERE user_id=?',(user['id'],)).fetchone()
        owned=[r['item'] for r in db.execute('SELECT item FROM cosmetics WHERE user_id=?',(user['id'],))]
        return {'today':today.isoformat(),'resetAt':datetime.combine(today+timedelta(days=1),datetime.min.time(),tzinfo=timezone.utc).isoformat(),'streak':current,'bestStreak':best,'claimedToday':bool(rows and rows[-1]['day']==today.isoformat()),'balance':wallet['shards'] if wallet else 0,'equipped':wallet['equipped'] if wallet else 'classic','owned':owned,'history':rows[-35:],'cosmetics':COSMETICS,'milestones':[{'days':n,'name':name,'unlocked':best>=n} for n,name in [(3,'First spark'),(7,'Weekly regular'),(14,'Unbroken loop'),(30,'Daily devotee')]]}
    def get(self,user):
        with self.community.db() as db:return self.summary(db,user)
    def claim(self,user,run):
        mode,seed,score,_=self.community.recalculate(run)
        if mode!='daily':raise APIError('Complete the daily quiz to earn a daily reward.')
        today=self.today().isoformat()
        with self.community.db() as db:
            db.execute('BEGIN IMMEDIATE')
            if db.execute('SELECT 1 FROM daily_claims WHERE user_id=? AND (day=? OR seed=?)',(user['id'],today,seed)).fetchone():raise APIError('This daily reward has already been claimed.',409)
            summary=self.summary(db,user);amount=100+(50 if (summary['streak']+1)%7==0 else 0)
            db.execute('INSERT INTO daily_claims VALUES(?,?,?,?,?,?)',(user['id'],today,seed,amount,score,int(time.time())))
            db.execute('INSERT INTO wallets(user_id,shards) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET shards=shards+excluded.shards',(user['id'],amount))
            return {'earned':amount,'rewards':self.summary(db,user)}
    def cosmetic(self,user,item,equip=False):
        if not isinstance(item,str) or item not in ['classic',*[c['id'] for c in COSMETICS]]:raise APIError('Unknown profile frame.')
        with self.community.db() as db:
            db.execute('BEGIN IMMEDIATE');db.execute('INSERT OR IGNORE INTO wallets(user_id) VALUES(?)',(user['id'],))
            owned=item=='classic' or bool(db.execute('SELECT 1 FROM cosmetics WHERE user_id=? AND item=?',(user['id'],item)).fetchone())
            if equip:
                if not owned:raise APIError('Unlock that frame before equipping it.')
            else:
                if owned:raise APIError('You already own that frame.',409)
                price=next(c['price'] for c in COSMETICS if c['id']==item)
                if db.execute('UPDATE wallets SET shards=shards-? WHERE user_id=? AND shards>=?',(price,user['id'],price)).rowcount!=1:raise APIError('Not enough Loop Shards. Finish more daily quizzes.')
                db.execute('INSERT INTO cosmetics VALUES(?,?)',(user['id'],item))
            db.execute('UPDATE wallets SET equipped=? WHERE user_id=?',(item,user['id']))
            return {'rewards':self.summary(db,user)}

"""Mutual friend requests and comparisons of explicitly submitted quiz results."""
from datetime import date,timedelta
import json,re,time
from community import APIError

class Friends:
    def __init__(self,community):
        self.community=community
        with community.db() as db:
            db.executescript('''CREATE TABLE IF NOT EXISTS friendships(
                user_low INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                user_high INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                requested_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                status TEXT NOT NULL CHECK(status IN ('pending','accepted')),
                created INTEGER NOT NULL,accepted INTEGER,
                PRIMARY KEY(user_low,user_high),CHECK(user_low<user_high),
                CHECK(requested_by=user_low OR requested_by=user_high));
                CREATE INDEX IF NOT EXISTS friendships_high ON friendships(user_high,status);''')

    def change(self,user,action,payload):
        me=user['id']
        with self.community.db() as db:
            db.execute('BEGIN IMMEDIATE')
            if action=='request':
                name=payload.get('username','')
                if not isinstance(name,str) or not re.fullmatch(r'[A-Za-z0-9_\-]{3,24}',name):raise APIError('Enter an exact AniLoop username.')
                target=db.execute('SELECT id FROM users WHERE username=?',(name,)).fetchone()
                if not target:raise APIError('No player has that username.',404)
                other=target['id']
            else:
                other=payload.get('userId')
                if type(other)!=int or other<=0:raise APIError('Choose a player.')
            if other==me:raise APIError('Choose another player to add as a friend.')
            low,high=sorted((me,other))
            row=db.execute('SELECT * FROM friendships WHERE user_low=? AND user_high=?',(low,high)).fetchone()
            if action=='request':
                if row:raise APIError('You are already friends.' if row['status']=='accepted' else 'A friend request is already pending. Check your requests.',409)
                count=db.execute('SELECT COUNT(*) FROM friendships WHERE user_low=? OR user_high=?',(me,me)).fetchone()[0]
                target_count=db.execute('SELECT COUNT(*) FROM friendships WHERE user_low=? OR user_high=?',(other,other)).fetchone()[0]
                if max(count,target_count)>=200:raise APIError('The friend list or request limit has been reached.',409)
                db.execute('INSERT INTO friendships VALUES(?,?,?,?,?,NULL)',(low,high,me,'pending',int(time.time())))
            elif not row:raise APIError('This friend request or friendship no longer exists.',404)
            elif action=='accept':
                if row['status']!='pending' or row['requested_by']==me:raise APIError('Only the recipient can accept a pending request.',403)
                db.execute("UPDATE friendships SET status='accepted',accepted=? WHERE user_low=? AND user_high=?",(int(time.time()),low,high))
            elif action=='decline':
                if row['status']!='pending' or row['requested_by']==me:raise APIError('Only the recipient can decline a pending request.',403)
                db.execute('DELETE FROM friendships WHERE user_low=? AND user_high=?',(low,high))
            elif action=='cancel':
                if row['status']!='pending' or row['requested_by']!=me:raise APIError('Only the sender can cancel a pending request.',403)
                db.execute('DELETE FROM friendships WHERE user_low=? AND user_high=?',(low,high))
            elif action=='remove':
                if row['status']!='accepted':raise APIError('This player is not on your friend list.',409)
                db.execute('DELETE FROM friendships WHERE user_low=? AND user_high=?',(low,high))
            else:raise APIError('Unknown friend action.')
        return {'ok':True}

    def view(self,user,day=None):
        try:selected=date.fromisoformat(day) if day else date.today()
        except (ValueError,TypeError):raise APIError('Choose a valid quiz date.')
        if day and day!=selected.isoformat():raise APIError('Choose a valid quiz date.')
        if not date.today()-timedelta(days=365)<=selected<=date.today()+timedelta(days=1):raise APIError('Choose a quiz date within the past year.')
        days=[(selected-timedelta(days=i)).isoformat() for i in range(6,-1,-1)]
        with self.community.db() as db:
            rows=db.execute('''SELECT f.*,u.id,u.username FROM friendships f JOIN users u
                ON u.id=CASE WHEN f.user_low=? THEN f.user_high ELSE f.user_low END
                WHERE f.user_low=? OR f.user_high=? ORDER BY u.username COLLATE NOCASE''',(user['id'],user['id'],user['id'])).fetchall()
            people=[{'userId':user['id'],'username':user['username'],'isSelf':True}]
            incoming=[];outgoing=[]
            for row in rows:
                profile={'userId':row['id'],'username':row['username']}
                if row['status']=='accepted':people.append({**profile,'isSelf':False})
                else:(outgoing if row['requested_by']==user['id'] else incoming).append(profile)
            ids=[p['userId'] for p in people];marks=','.join('?' for _ in ids)
            daily=db.execute(f"SELECT user_id,seed,score,breakdown FROM scores WHERE user_id IN ({marks}) AND mode='daily' AND seed>=? AND seed<=?",(*ids,days[0],days[-1])).fetchall()
            infinity=db.execute(f"SELECT user_id,MAX(score) AS best,COUNT(*) AS rounds FROM scores WHERE user_id IN ({marks}) AND mode='infinity' GROUP BY user_id",ids).fetchall()
        daily_by={(r['user_id'],r['seed']):r for r in daily};infinity_by={r['user_id']:r for r in infinity}
        for person in people:
            uid=person['userId'];today=daily_by.get((uid,selected.isoformat()));best=infinity_by.get(uid)
            person.update(dailyScore=today['score'] if today else None,breakdown=json.loads(today['breakdown']) if today else None,bestInfinity=best['best'] if best else None,infinityRounds=best['rounds'] if best else 0,history=[{'day':d,'score':daily_by[(uid,d)]['score'] if (uid,d) in daily_by else None} for d in days])
        people.sort(key=lambda p:(p['dailyScore'] is None,-(p['dailyScore'] or 0),p['username'].lower()))
        return {'day':selected.isoformat(),'days':days,'incoming':incoming,'outgoing':outgoing,'players':people,'friendCount':len(people)-1}

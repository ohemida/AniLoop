"""Server-owned party and co-op rooms, persisted in the community SQLite database."""
import copy,json,random,re,secrets,time
from community import APIError
CATEGORIES=['screenshot','character','opening','ending','anidle']
LEVELS=['Easy','Medium','Hard']
STEPS=[(category,index) for category in CATEGORIES for index in range(1 if category=='anidle' else 3)]
class Rooms:
    def __init__(self,community):
        self.community=community
        with community.db() as db:
            db.executescript('''CREATE TABLE IF NOT EXISTS rooms(code TEXT PRIMARY KEY,owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,mode TEXT NOT NULL,state TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,created INTEGER NOT NULL,updated INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS room_members(code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,joined INTEGER NOT NULL,PRIMARY KEY(code,user_id));''')
    def fresh_session(self,number=1,previous=None):
        randomizer=random.SystemRandom();entries=list(self.community.catalog.values());games={}
        def choose(pool,avoid=()):
            fresh=[a for a in pool if a['id'] not in avoid];return randomizer.choice(fresh or pool)
        for category in CATEGORIES:
            old=(previous or {}).get('games',{}).get(category,{});avoid=old.get('questions',[]);questions=[];refs=[];frames=[]
            if category=='character':
                for level in LEVELS:
                    pool=[(a,c) for a in entries for c in a.get('characters',[]) if c['difficulty']==level];randomizer.shuffle(pool);selected=[]
                    for anime,character in pool:
                        if any(character['id']==c['id'] or anime['id']==a['id'] for a,c in selected):continue
                        selected.append((anime,character))
                        if len(selected)==4:break
                    questions.append([a['id'] for a,c in selected]);refs.append([c['id'] for a,c in selected])
            elif category=='anidle':
                pool=[a for a in entries if a.get('year') and a.get('score') is not None and all(a.get(k) for k in ['studio','source','genres','cover','synopsis','popularCharacter'])]
                questions=[choose(pool,avoid)['id']]
            else:
                for level in LEVELS:
                    pool=[a for a in entries if (a.get('screenshots') if category=='screenshot' else a.get(category)) and ((a.get(category) or {}).get('difficulty',(a.get('difficulty') or {}).get(category)) if category!='screenshot' else (a.get('difficulty') or {}).get(category))==level]
                    anime=choose(pool,avoid);questions.append(anime['id'])
                    if category=='screenshot':frames.append(randomizer.sample(range(len(anime['screenshots'])),min(3,len(anime['screenshots']))))
            games[category]={'questions':questions,'characterRefs':refs,'frames':frames,'levels':LEVELS if category!='anidle' else ['Mixed'],'index':0,'scores':[],'answers':[],'hints':[],'guesses':[],'attempt':1,'done':False}
        return {'version':2,'mode':'infinity','number':number,'seed':secrets.token_hex(16),'packKey':self.community.pack_key,'games':games}
    def cleanup(self,db):db.execute('DELETE FROM rooms WHERE updated<?',(int(time.time())-86400,))
    def members(self,db,code):return [dict(r) for r in db.execute('SELECT u.id,u.username,m.joined FROM room_members m JOIN users u ON u.id=m.user_id WHERE m.code=? ORDER BY m.joined,u.id',(code,)).fetchall()]
    def load(self,db,code,user):
        if not isinstance(code,str) or not re.fullmatch('[A-Z2-9]{6}',code):raise APIError('Enter a valid six-character room code.')
        row=db.execute('SELECT * FROM rooms WHERE code=?',(code,)).fetchone()
        if not row or row['updated']<int(time.time())-86400:raise APIError('That room has expired or does not exist.',404)
        members=self.members(db,code)
        if not any(m['id']==user['id'] for m in members):raise APIError('Join this room before viewing it.',403)
        room=dict(row);room['state']=json.loads(room['state'])
        live_ids={str(m['id']) for m in members};changed=False
        for player_id in list(room['state'].get('players',{})):
            if player_id not in live_ids:del room['state']['players'][player_id];changed=True
        if room['owner_id'] not in [m['id'] for m in members]:room['owner_id']=members[0]['id'];changed=True
        if changed:self.save(db,room)
        return room,members
    def public(self,room,members,user):
        state=room['state'];step=state.get('step',0);category,index=STEPS[min(step,len(STEPS)-1)]
        progress=state.get('team') if room['mode']=='coop' else state.get('players',{}).get(str(user['id']))
        session=progress or state.get('template');ready=bool(progress and len(progress['games'][category]['scores'])>index)
        players=[]
        for member in members:
            game=state.get('players',{}).get(str(member['id'])) if room['mode']=='party' else state.get('team')
            score=sum(sum(g['scores']) for g in game['games'].values()) if game else 0
            done=bool(game and len(game['games'][category]['scores'])>index)
            players.append({'id':member['id'],'username':member['username'],'score':score,'ready':done,'host':member['id']==room['owner_id']})
        all_ready=all(p['ready'] for p in players) if room['mode']=='party' else ready
        turn=f"{state.get('loop',1)}:{step}:{len(session['games'][category]['scores'])}:{session['games'][category]['attempt']}:{','.join(map(str,session['games'][category]['hints']))}" if session else None
        return {'turn':turn,'code':room['code'],'mode':room['mode'],'hostId':room['owner_id'],'revision':room['revision'],'phase':state['phase'],'loop':state.get('loop',1),'step':step,'totalSteps':len(STEPS),'category':category,'questionIndex':index,'session':session,'players':players,'ready':ready,'allReady':all_ready,'hintsRemaining':state.get('hintsRemaining',8),'hintBudget':8,'expiresAt':room['updated']+86400}
    def current(self,user):
        with self.community.db() as db:
            self.cleanup(db);row=db.execute('SELECT code FROM room_members WHERE user_id=?',(user['id'],)).fetchone()
            if not row:return {'room':None}
            room,members=self.load(db,row['code'],user);return {'room':self.public(room,members,user)}
    def get(self,user,code):
        with self.community.db() as db:
            room,members=self.load(db,code,user);return {'room':self.public(room,members,user)}
    def create(self,user,mode):
        if mode not in {'party','coop'}:raise APIError('Choose Party or Co-op Infinity.')
        now=int(time.time())
        with self.community.db() as db:
            db.execute('BEGIN IMMEDIATE');self.cleanup(db)
            if db.execute('SELECT 1 FROM room_members WHERE user_id=?',(user['id'],)).fetchone():raise APIError('Leave your current room before creating another.',409)
            if db.execute('SELECT COUNT(*) FROM rooms').fetchone()[0]>=1000:raise APIError('Room capacity reached. Try again later.',429)
            for _ in range(10):
                code=''.join(secrets.choice('ABCDEFGHJKLMNPQRSTUVWXYZ23456789') for _ in range(6))
                if not db.execute('SELECT 1 FROM rooms WHERE code=?',(code,)).fetchone():break
            state={'phase':'lobby','loop':1,'step':0,'hintsRemaining':8}
            db.execute('INSERT INTO rooms VALUES(?,?,?,?,?,?,?)',(code,user['id'],mode,json.dumps(state),1,now,now));db.execute('INSERT INTO room_members VALUES(?,?,?)',(code,user['id'],now))
            room,members=self.load(db,code,user);return {'room':self.public(room,members,user)}
    def join(self,user,code):
        code=str(code or '').strip().upper()
        if not re.fullmatch('[A-Z2-9]{6}',code):raise APIError('Enter a valid six-character room code.')
        with self.community.db() as db:
            db.execute('BEGIN IMMEDIATE');self.cleanup(db)
            current=db.execute('SELECT code FROM room_members WHERE user_id=?',(user['id'],)).fetchone()
            if current:
                if current['code']!=code:raise APIError('Leave your current room before joining another.',409)
                room,members=self.load(db,code,user);return {'room':self.public(room,members,user)}
            row=db.execute('SELECT * FROM rooms WHERE code=?',(code,)).fetchone()
            if not row:raise APIError('Room not found. Check the code.',404)
            if json.loads(row['state'])['phase']!='lobby':raise APIError('This room has already started. Join before the host starts the game.',409)
            if len(self.members(db,code))>=8:raise APIError('This room is full (8 players).',409)
            db.execute('INSERT INTO room_members VALUES(?,?,?)',(code,user['id'],int(time.time())))
            db.execute('UPDATE rooms SET revision=revision+1,updated=? WHERE code=?',(int(time.time()),code))
            room,members=self.load(db,code,user);return {'room':self.public(room,members,user)}
    def save(self,db,room):
        room['revision']+=1;room['updated']=int(time.time())
        db.execute('UPDATE rooms SET owner_id=?,state=?,revision=?,updated=? WHERE code=?',(room['owner_id'],json.dumps(room['state']),room['revision'],room['updated'],room['code']))
    def action(self,user,code,data):
        action=data.get('action')
        with self.community.db() as db:
            db.execute('BEGIN IMMEDIATE');room,members=self.load(db,code,user);state=room['state']
            if action=='leave':
                db.execute('DELETE FROM room_members WHERE code=? AND user_id=?',(code,user['id']));members=self.members(db,code)
                if not members:db.execute('DELETE FROM rooms WHERE code=?',(code,))
                else:
                    if room['owner_id']==user['id']:room['owner_id']=members[0]['id']
                    state.get('players',{}).pop(str(user['id']),None)
                    self.save(db,room)
                return {'room':None}
            if type(data.get('revision'))!=int or data['revision']!=room['revision']:
                own_turn_unchanged=action in {'hint','skip','answer','giveup'} and state['phase']=='playing' and data.get('turn')==self.public(room,members,user)['turn']
                if not own_turn_unchanged:raise APIError('The room changed. Refreshing the shared round; try again.',409)
            if action=='kick':
                if room['owner_id']!=user['id'] or data.get('userId')==user['id']:raise APIError('Only the host can remove another player.',403)
                if not any(m['id']==data.get('userId') for m in members):raise APIError('Player not found.')
                db.execute('DELETE FROM room_members WHERE code=? AND user_id=?',(code,data['userId']));state.get('players',{}).pop(str(data['userId']),None);members=self.members(db,code);self.save(db,room);return {'room':self.public(room,members,user)}
            if action in {'start','next','next-loop'} and room['owner_id']!=user['id']:raise APIError('Only the host can advance the room.',403)
            if action=='start':
                if state['phase']!='lobby':raise APIError('The room has already started.',409)
                if len(members)<2:raise APIError('Invite at least one other player before starting.')
                template=self.fresh_session();state.update(phase='playing',template=template,team=copy.deepcopy(template),players={str(m['id']):copy.deepcopy(template) for m in members})
            elif action=='next-loop':
                if state['phase']!='complete':raise APIError('Finish every category before starting a new loop.',409)
                template=self.fresh_session(state['loop']+1,state['template']);state.update(phase='playing',step=0,loop=state['loop']+1,template=template,team=copy.deepcopy(template),players={str(m['id']):copy.deepcopy(template) for m in members},hintsRemaining=8)
            elif action=='next':
                snapshot=self.public(room,members,user)
                if state['phase']!='playing' or not snapshot['allReady']:raise APIError('Wait until everyone has finished this question.',409)
                if state['step']>=len(STEPS)-1:state['phase']='complete'
                else:
                    state['step']+=1;category,index=STEPS[state['step']]
                    for session in [state['team'],*state['players'].values()]:
                        game=session['games'][category];game.update(index=index,hints=[],activeFrame=0,musicMode='audio')
            else:
                if state['phase']!='playing':raise APIError('The host must start the room first.',409)
                category,index=STEPS[state['step']];session=state['team'] if room['mode']=='coop' else state['players'][str(user['id'])];game=session['games'][category]
                if len(game['scores'])>index:raise APIError('This question is already finished. Wait for the host.',409)
                if action=='hint':
                    number=data.get('number');allowed=range(1,4) if category=='screenshot' else [1] if category in {'opening','ending'} else []
                    if type(number)!=int or number not in allowed:raise APIError('Invalid clue.')
                    if number in game['hints']:return {'room':self.public(room,members,user)}
                    if category=='screenshot' and number>1 and number-1 not in game['hints']:raise APIError('Unlock clues in order.')
                    if room['mode']=='coop':
                        if state['hintsRemaining']<=0:raise APIError('Your team has used all eight hints for this loop.',409)
                        state['hintsRemaining']-=1
                    game['hints'].append(number)
                elif action=='skip':
                    if category!='anidle' or game['attempt']<=3 or game['attempt']>=22:raise APIError('No clue can be skipped to right now.')
                    game['attempt']=next(n for n in [13,18,22] if n>game['attempt'])
                elif action in {'answer','giveup'}:self.answer(game,category,index,data,action=='giveup')
                else:raise APIError('Unknown room action.')
            self.save(db,room);return {'room':self.public(room,members,user)}
    def answer(self,game,category,index,data,giveup=False):
        service=self.community;score=0;answer={'value':'Gave up','hints':list(game['hints']),'attempt':game['attempt']}
        if category=='character':
            entries=data.get('entries',[]) if not giveup else [{} for _ in range(4)]
            if not isinstance(entries,list) or len(entries)!=4:raise APIError('Provide four character answers.')
            outcomes=[]
            for anime_id,ref,entry in zip(game['questions'][index],game['characterRefs'][index],entries):
                if not isinstance(entry,dict):raise APIError('Invalid character answer.')
                anime=service.catalog[anime_id];character=next(c for c in anime['characters'] if c['id']==ref)
                name=str(entry.get('characterValue',''))[:200];title=str(entry.get('animeValue',''))[:300]
                name_ok=service.match(name,[character['name'],*character.get('aliases',[])]);anime_ok=service.title_match(title,anime)
                score+=(2000 if name_ok else 0)+(500 if anime_ok else 0)
                outcomes.append({'character':name_ok,'anime':anime_ok,'characterValue':name,'animeValue':title})
            answer['entries']=outcomes
        elif not giveup:
            value=data.get('value','')
            if not isinstance(value,str) or not value.strip() or len(value)>300:raise APIError('Enter an anime title.')
            guess=next((a for a in service.catalog.values() if service.match(value,[a['title']])),None) or next((a for a in service.catalog.values() if service.title_match(value,a)),None)
            if not guess:raise APIError('Choose an anime from the suggestions.')
            target=service.catalog[game['questions'][index]];correct=guess['id']==target['id'] if category=='anidle' else service.title_match(value,target);answer.update(value=guess['title'],correct=correct)
            if category=='anidle':
                if any(g['id']==guess['id'] for g in game['guesses']):raise APIError('This anime has already been guessed.')
                game['guesses'].append({'id':guess['id'],'attempt':game['attempt']})
                if not correct and game['attempt']<22:game['attempt']+=1;return
                score=max(0,10000-max(0,game['attempt']-3)*500) if correct else 0
            else:score=max(0,(10000 if category=='screenshot' else 5000)-2500*len(game['hints'])) if correct else 0
        game['scores'].append(score);game['answers'].append(answer);game['done']=len(game['scores'])==len(game['questions'])

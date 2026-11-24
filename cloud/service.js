import {GameError,check,clone,today,timestamp,COSMETICS,recalculate,rewards,newAccount,makeRoom,roomView,roomAction,dailyAction} from './engine.js';
import {transaction} from './store.js';
import {CATEGORIES,createSession,totalScore} from '../core.js';

const validId=value=>typeof value==='string'&&/^[0-9a-f-]{36}$/i.test(value);
const cleanText=(value,max)=>String(value??'').trim().slice(0,max);
const dayDate=value=>{const d=new Date(value+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value?d:null;};
const pairKey=(a,b)=>[a,b].sort().join(':');
// Profile pictures: the owner always sees their own picture; everyone else only
// sees it after the safety filter (or an administrator) approved it.
const PICTURE_TYPES={png:'iVBORw0KGgo',jpeg:'/9j/',webp:'UklGR'};
const pictureUrl=a=>a?.picture?`data:image/${a.pictureType||'png'};base64,${a.picture}`:null;
const publicPicture=a=>a?.pictureStatus==='approved'?pictureUrl(a):null;
const pictureStatus=a=>a?.picture?(a.pictureStatus||'private'):null;
const PICTURE_UPLOADS_PER_DAY=10;
export class CloudService{
 constructor(repository,pack,options={}){this.repo=repository;this.pack=pack;this.dailySecret=options.dailySecret||'';this.moderateImage=options.moderateImage||null;}
 // The daily seed is an HMAC of the date with a server secret, so nobody can
 // compute today's questions without an account (no private-tab replays).
 async dailySeed(day){
  check(this.dailySecret,'The daily quiz is not configured on the server yet.',503);
  const encoder=new TextEncoder(),key=await crypto.subtle.importKey('raw',encoder.encode(this.dailySecret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(`aniloop-daily:${this.pack.key}:${day}`)));
  return [...bytes.slice(0,16)].map(b=>b.toString(16).padStart(2,'0')).join('');
 }
 dailyView(record,account=null,earned=0){
  const finished=CATEGORIES.every(c=>record.session.games[c.id].done);
  return {day:record.day,session:record.session,finished,score:totalScore(record.session),resetAt:new Date(Date.parse(record.day+'T00:00:00Z')+86400000).toISOString(),...(account?{rewards:rewards(account)}:{}),earned};
 }
 async daily(actor){
  const day=today(),seed=await this.dailySeed(day);
  return transaction(this.repo,actor,async tx=>{
   const key='daily:'+actor;let record=await tx.get(key);
   if(!record||record.day!==day||record.packKey!==this.pack.key){
    const session=createSession('daily',day,seed,this.pack.anime,this.pack.key);session.seed=day;
    record={day,packKey:this.pack.key,session,scored:false};await tx.put(key,record,actor);
   }
   return this.dailyView(record);
  });
 }
 async dailyAct(actor,payload,skipScore=false){
  const day=today();
  try{
   return await transaction(this.repo,actor,async tx=>{
    const key='daily:'+actor,record=await tx.get(key);
    check(record&&record.day===day&&record.packKey===this.pack.key,'A new daily quiz has started. Reload to play it.',409);
    dailyAction(record.session,payload?.category,payload||{},this.pack);
    let account=null,earned=0;
    if(!record.scored&&CATEGORIES.every(c=>record.session.games[c.id].done)){
     record.scored=true;const score=totalScore(record.session);
     const breakdown=Object.fromEntries(CATEGORIES.map(c=>[c.id,record.session.games[c.id].scores.reduce((a,b)=>a+b,0)]));
     if(!skipScore)tx.score={mode:'daily',seed:day,score,breakdown};
     account=await tx.get('account:'+actor)||newAccount();
     if(!account.claims.some(c=>c.day===day)){const streak=rewards(account).streak;earned=100+((streak+1)%7===0?50:0);account.shards+=earned;account.claims.push({day,seed:day,amount:earned,score});await tx.put('account:'+actor,account,actor);}
    }
    await tx.put(key,record,actor);
    return this.dailyView(record,account,earned);
   });
  }catch(error){
   // A daily score submitted by an older client today already occupies the
   // leaderboard slot; finish the run without inserting a duplicate score.
   if(!skipScore&&error?.status===409&&/already exists/i.test(error.message))return this.dailyAct(actor,payload,true);
   throw error;
  }
 }
 async picturesFor(ids){
  if(typeof this.repo.pictures==='function')return this.repo.pictures(ids);
  const rows=await Promise.all(ids.map(async id=>[id,(await this.repo.getRuntime('account:'+id))?.value]));
  return new Map(rows.map(([id,a])=>[id,publicPicture(a)]).filter(([,url])=>url));
 }
 async ensureAccount(actor){return transaction(this.repo,actor,async tx=>{let account=await tx.get('account:'+actor);if(!account){account={shards:0,equipped:'classic',owned:[],scores:[],claims:[],picture:null};await tx.put('account:'+actor,account,actor);}return account;});}
 async ensureProfile(actor,metadata={}){
  let profile=await this.repo.profile(actor);if(profile)return profile;
  const username=cleanText(metadata.username,24);check(/^[A-Za-z0-9_-]{3,24}$/.test(username),'Choose a public username before continuing.');
  const result=await this.repo.request('/rest/v1/rpc/aniloop_cloud_create_profile',{p_actor:actor,p_username:username,p_adult_confirmed:metadata.adultConfirmed===true,p_notice_version:metadata.noticeVersion},this.repo.serviceSecret);
  await this.ensureAccount(actor);return await this.repo.profile(actor);
 }
 async current(actor,user){
  if(!actor)return {user:null};
  const profile=await this.ensureProfile(actor,user?.user_metadata||{});const account=await this.ensureAccount(actor);const admin=await this.repo.isAdmin(actor);
  return {user:{id:actor,username:profile.username,email:user.email,provider:'supabase',isAdmin:admin,hasPicture:!!account.picture,pictureUrl:pictureUrl(account),pictureStatus:pictureStatus(account)}};
 }
 async leaderboard(q){const mode=q.get('mode')||'infinity',period=q.get('period')||'all';check(['daily','infinity'].includes(mode)&&['all','week','today'].includes(period),'Invalid leaderboard filter.');const rows=await this.repo.request('/rest/v1/rpc/aniloop_cloud_leaderboard',{p_mode:mode,p_period:period});const pictures=rows.length?await this.picturesFor(rows.map(r=>r.userId).filter(validId)).catch(()=>new Map()):new Map();return {entries:rows.map((r,i)=>({...r,rank:i+1,pictureUrl:pictures.get(r.userId)||null}))};}
 async submit(actor,round){const score=recalculate(round,this.pack);check(score.mode!=='daily','Daily results are saved automatically when you finish the daily quiz.');const result=await transaction(this.repo,actor,async tx=>{tx.score={mode:score.mode,seed:score.seed,score:score.score,breakdown:score.breakdown};return {score:score.score,breakdown:score.breakdown};});return result;}
 async rewards(actor){return {rewards:rewards(await this.ensureAccount(actor))};}
 // Rewards are normally granted automatically when the server-side daily is
 // finished; this endpoint only repairs a missed claim from that record.
 async claim(actor){const day=today();return transaction(this.repo,actor,async tx=>{const record=await tx.get('daily:'+actor);check(record?.day===day&&CATEGORIES.every(c=>record.session.games[c.id].done),'Complete today’s daily quiz to earn a daily reward.');const a=await tx.get('account:'+actor)||newAccount();check(!a.claims.some(c=>c.day===day),'This daily reward has already been claimed.',409);const score=totalScore(record.session),streak=rewards(a).streak,amount=100+((streak+1)%7===0?50:0);a.shards+=amount;a.claims.push({day,seed:day,amount,score});await tx.put('account:'+actor,a,actor);return {earned:amount,rewards:rewards(a)};});}
 async cosmetic(actor,item,equip){check(typeof item==='string'&&['classic',...COSMETICS.map(c=>c.id)].includes(item),'Unknown profile frame.');return transaction(this.repo,actor,async tx=>{const a=await tx.get('account:'+actor)||{shards:0,equipped:'classic',owned:[],claims:[],scores:[],picture:null};if(equip){check(item==='classic'||a.owned.includes(item),'Unlock that frame before equipping it.');}else{check(item!=='classic','You already own that frame.',409);check(!a.owned.includes(item),'You already own that frame.',409);const cost=COSMETICS.find(c=>c.id===item).price;check(a.shards>=cost,'Not enough Loop Shards.');a.shards-=cost;a.owned.push(item);}a.equipped=item;await tx.put('account:'+actor,a,actor);return {rewards:rewards(a)};});}
 async friendChange(actor,action,payload){
  check(['request','accept','decline','cancel','remove'].includes(action),'Unknown friend action.');
  if(action==='request'){
   const name=cleanText(payload.username,24);check(/^[A-Za-z0-9_-]{3,24}$/.test(name),'Enter an exact AniLoop username.');const target=await this.repo.findProfile(name);check(target,'No player has that username.',404);check(target.id!==actor,'Choose another player to add as a friend.');
   return transaction(this.repo,actor,async tx=>{const ids=pairKey(actor,target.id),key='friend:'+ids,indexA='friends:'+actor,indexB='friends:'+target.id;const [row,a,b]=await Promise.all([tx.get(key),tx.get(indexA),tx.get(indexB)]);check(!row,row?.status==='accepted'?'You are already friends.':'A friend request is already pending. Check your requests.',409);check((a?.ids?.length||0)<200&&(b?.ids?.length||0)<200,'The friend list or request limit has been reached.',409);await tx.put(key,{members:[actor,target.id].sort(),requestedBy:actor,status:'pending',created:timestamp()});await tx.put(indexA,{ids:[...(a?.ids||[]),target.id]},actor);await tx.put(indexB,{ids:[...(b?.ids||[]),actor]},target.id);return {ok:true};});
  }
  const other=payload.userId;check(validId(other)&&other!==actor,'Choose another player.');const key='friend:'+pairKey(actor,other);
  return transaction(this.repo,actor,async tx=>{const row=await tx.get(key);check(row,'This friend request or friendship no longer exists.',404);if(action==='accept'||action==='decline')check(row.status==='pending'&&row.requestedBy!==actor,'Only the recipient can '+action+' a pending request.',403);if(action==='cancel')check(row.status==='pending'&&row.requestedBy===actor,'Only the sender can cancel a pending request.',403);if(action==='remove')check(row.status==='accepted','This player is not on your friend list.',409);if(action==='accept'){row.status='accepted';row.accepted=timestamp();await tx.put(key,row);}else{await tx.remove(key);for(const id of [actor,other]){const index=await tx.get('friends:'+id);await tx.put('friends:'+id,{ids:(index?.ids||[]).filter(x=>x!==(id===actor?other:actor))},id);}}return {ok:true};});
 }
 async friends(actor,dayValue){const day=dayValue||today(),date=dayDate(day);check(date&&date.getTime()>=Date.now()-366*86400000&&date.getTime()<=Date.now()+86400000,'Choose a valid quiz date within the past year.');const index=await this.repo.getRuntime('friends:'+actor);const ids=[actor,...(index?.value?.ids||[])].slice(0,201);const rows=await Promise.all(ids.map(async id=>({id,row:await this.repo.getRuntime('friend:'+pairKey(actor,id))})));const accepted=rows.filter(x=>x.id===actor||x.row?.value?.status==='accepted').map(x=>x.id);const profiles=await Promise.all(ids.map(id=>this.repo.profile(id)));const names=new Map(profiles.filter(Boolean).map(p=>[p.id,p.username]));const scores=await this.repo.request('/rest/v1/rpc/aniloop_cloud_friend_scores',{p_ids:accepted,p_day:day});const result=new Map(scores.map(x=>[x.id,x]));const days=Array.from({length:7},(_,i)=>{const d=new Date(date);d.setUTCDate(d.getUTCDate()-6+i);return d.toISOString().slice(0,10);});const incomingIds=rows.filter(x=>x.id!==actor&&x.row?.value?.status==='pending'&&x.row.value.requestedBy!==actor).map(x=>x.id);const [pictures,own]=await Promise.all([this.picturesFor([...accepted.filter(id=>id!==actor),...incomingIds]).catch(()=>new Map()),this.repo.getRuntime('account:'+actor)]);pictures.set(actor,pictureUrl(own?.value));const incoming=[],outgoing=[];for(const x of rows){if(x.id===actor||x.row?.value?.status!=='pending')continue;const mine=x.row.value.requestedBy===actor,p={userId:x.id,username:names.get(x.id)||'Player',pictureUrl:mine?null:pictures.get(x.id)||null};(mine?outgoing:incoming).push(p);}const players=accepted.map(id=>{const p=result.get(id)||{};const record=(p.daily||[]).find(r=>r.day===day);const dailyMap=new Map((p.daily||[]).map(r=>[r.day,r]));return {userId:id,username:names.get(id)||'Player',isSelf:id===actor,pictureUrl:pictures.get(id)||null,dailyScore:record?.score??null,breakdown:record?.breakdown??null,bestInfinity:p.bestInfinity??null,infinityRounds:p.infinityRounds||0,history:days.map(d=>({day:d,score:dailyMap.get(d)?.score??null}))};});players.sort((a,b)=>(a.dailyScore===null)-(b.dailyScore===null)||(b.dailyScore||0)-(a.dailyScore||0)||a.username.localeCompare(b.username));return {day,days,incoming,outgoing,players,friendCount:players.filter(p=>!p.isSelf).length};}
 async createRoom(actor,user,mode){check(['party','coop'].includes(mode),'Choose Party or Co-op Infinity.');for(let i=0;i<5;i++){const code=Math.random().toString(36).slice(2,8).toUpperCase().replace(/[01]/g,'A');try{return await transaction(this.repo,actor,async tx=>{check(!await tx.get('membership:'+actor),'Leave your current room first.',409);const room=makeRoom(code,{id:actor,username:user.username},mode);await tx.put('room:'+code,room,null);await tx.put('membership:'+actor,{code},actor);return {room:roomView(room,actor)};});}catch(e){if(e.status!==409||e.message==='Leave your current room first.')throw e;}}throw new GameError('Could not create a room. Try again.',503);}
 async joinRoom(actor,user,code){code=cleanText(code,6).toUpperCase();check(/^[A-Z2-9]{6}$/.test(code),'Enter a valid six-character room code.');return transaction(this.repo,actor,async tx=>{check(!await tx.get('membership:'+actor),'Leave your current room first.',409);const room=await tx.get('room:'+code);check(room&&room.updated+86400>timestamp(),'Room not found or expired.',404);check(room.state.phase==='lobby'&&room.members.length<8,'This room is full or has already started.',409);room.members.push({id:actor,username:user.username,joined:timestamp()});room.revision++;room.updated=timestamp();await tx.put('room:'+code,room,null);await tx.put('membership:'+actor,{code},actor);return {room:roomView(room,actor)};});}
 async roomCurrent(actor){const m=await this.repo.getRuntime('membership:'+actor);if(!m?.value)return {room:null};const r=await this.repo.getRuntime('room:'+m.value.code);return {room:r?.value?roomView(r.value,actor):null};}
 async roomGet(actor,code){const row=await this.repo.getRuntime('room:'+cleanText(code,6).toUpperCase());check(row?.value&&row.value.updated+86400>timestamp(),'Room not found or expired.',404);return {room:roomView(row.value,actor)};}
 async roomMutate(actor,code,data){code=cleanText(code,6).toUpperCase();return transaction(this.repo,actor,async tx=>{const room=await tx.get('room:'+code);check(room&&room.updated+86400>timestamp(),'Room not found or expired.',404);roomAction(room,actor,data,this.pack);if(!room.members.some(m=>m.id===actor))await tx.remove('membership:'+actor);else await tx.put('membership:'+actor,{code},actor);if(!room.members.length)await tx.remove('room:'+code);else await tx.put('room:'+code,room,null);return {room:room.members.some(m=>m.id===actor)?roomView(room,actor):null};});}
 async picture(actor,payload){
  const raw=payload?.image,saved=a=>({hasPicture:!!a.picture,pictureUrl:pictureUrl(a),pictureStatus:pictureStatus(a)});
  if(raw===null)return transaction(this.repo,actor,async tx=>{const a=await tx.get('account:'+actor)||newAccount();Object.assign(a,{picture:null,pictureType:null,pictureStatus:null});await tx.put('account:'+actor,a,actor);return saved(a);});
  const match=typeof raw==='string'?/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(raw):null;
  check(match&&match[2].length<=470_000&&match[2].startsWith(PICTURE_TYPES[match[1]]),'The prepared profile picture could not be saved. Choose a PNG, JPEG or WebP image up to 8 MB.');
  const day=today(),current=(await this.repo.getRuntime('account:'+actor))?.value,uploads=current?.pictureUploads?.day===day?current.pictureUploads.count:0;
  check(uploads<PICTURE_UPLOADS_PER_DAY,'You changed your profile picture too often today. Try again tomorrow.',429);
  // Safety filter (nudity, sexual content, graphic violence, self-harm). If no
  // filter is configured or it is unreachable, fail closed: the picture stays
  // visible only to its owner until an administrator approves it.
  let verdict={status:'pending'};
  if(this.moderateImage){try{verdict=await this.moderateImage(raw)||verdict;}catch{verdict={status:'pending'};}}
  if(verdict.status==='rejected'){await transaction(this.repo,actor,async tx=>{const a=await tx.get('account:'+actor)||newAccount();a.pictureUploads={day,count:uploads+1};await tx.put('account:'+actor,a,actor);});throw new GameError('This picture was blocked by the safety filter. Profile pictures must not show nudity, sexual content, graphic violence or self-harm.',422);}
  return transaction(this.repo,actor,async tx=>{const a=await tx.get('account:'+actor)||newAccount();Object.assign(a,{picture:match[2],pictureType:match[1],pictureStatus:verdict.status==='approved'?'approved':'pending',pictureChecked:timestamp(),pictureUploads:{day,count:uploads+1}});await tx.put('account:'+actor,a,actor);return saved(a);});
 }
 async exportAccount(actor,jwt){const data=await this.repo.request('/rest/v1/rpc/aniloop_export_own_account',{},jwt);const own=await this.repo.getRuntime('account:'+actor);const rows=await this.repo.request('/rest/v1/aniloop_runtime?'+new URLSearchParams({owner_id:'eq.'+actor,select:'key,value,revision'}));return {cloud:data,privateData:{account:own?.value||null,records:rows.filter(r=>r.key!=='account:'+actor)}};}
 async deleteAccount(actor,jwt){await this.repo.request('/rest/v1/rpc/aniloop_delete_own_account',{},jwt);return {ok:true};}
 async save(actor,payload,readOnly){const key='save:'+actor;if(readOnly){const row=await this.repo.getRuntime(key);return {state:row?.value?.state||null,savedAt:row?.value?.savedAt||0};}const value=payload?.state;check(value&&typeof value==='object'&&!Array.isArray(value)&&value.version===1,'Invalid save data.');const encoded=JSON.stringify(value);check(encoded.length<=500_000,'Cloud saves are limited to 500 KB.');return transaction(this.repo,actor,async tx=>{await tx.put(key,{state:value,savedAt:timestamp()*1000},actor);return {savedAt:timestamp()*1000};});}
 async handle(actor,user,method,path,payload,jwt){
  const route=path.split('?')[0],query=new URLSearchParams(path.split('?')[1]||'');
  if(route==='/api/config')return {supabaseEnabled:true,gameDataStorage:'supabase'};
  if(route==='/api/leaderboard')return this.leaderboard(query);
  if(route==='/api/account'&&!actor)return {user:null};
  if(route==='/api/bugs')throw new GameError('Bug report intake is not configured yet.',503);
  if(route==='/api/hints')throw new GameError('This clip has no preprocessed protected hint asset configured in Supabase Storage yet.',503);
  check(!!actor,'Sign in to continue.',401);
  if(route==='/api/account')return this.current(actor,user);
  if(route==='/api/account/save')return this.save(actor,payload,method==='GET');
  if(route==='/api/account/export')return this.exportAccount(actor,jwt);
  if(route==='/api/account/delete')return this.deleteAccount(actor,jwt);
  if(route==='/api/account/picture'){if(method!=='GET')return this.picture(actor,payload);const a=await this.ensureAccount(actor);return {pictureUrl:pictureUrl(a),pictureStatus:pictureStatus(a)};}
  if(route==='/api/daily')return this.daily(actor);
  if(route==='/api/daily/action')return this.dailyAct(actor,payload);
  if(route==='/api/scores')return this.submit(actor,payload.round);
  if(route==='/api/rewards')return this.rewards(actor);
  if(route==='/api/rewards/claim')return this.claim(actor);
  if(route==='/api/rewards/buy'||route==='/api/rewards/equip')return this.cosmetic(actor,payload.item,route.endsWith('/equip'));
  if(route==='/api/friends'&&method==='GET')return this.friends(actor,query.get('day'));
  if(route.startsWith('/api/friends/'))return this.friendChange(actor,route.split('/').at(-1),payload);
  if(route==='/api/rooms/current')return this.roomCurrent(actor);
  if(route==='/api/rooms/view')return this.roomGet(actor,query.get('code'));
  if(route==='/api/rooms/create')return this.createRoom(actor,await this.repo.profile(actor),payload.mode);
  if(route==='/api/rooms/join')return this.joinRoom(actor,await this.repo.profile(actor),payload.code);
  if(route==='/api/rooms/action')return this.roomMutate(actor,payload.code,payload);
  if(route==='/api/admin')return this.adminSummary(actor);
  if(route==='/api/admin/action')return this.adminAction(actor,payload);
  throw new GameError('Unknown endpoint.',404);
 }
 async adminSummary(actor){check(await this.repo.isAdmin(actor),'Administrator access required.',403);const [profiles,wallets,admins,reports]=await Promise.all([this.repo.request('/rest/v1/aniloop_profiles?select=id,username&order=username.asc&limit=100'),this.repo.request('/rest/v1/aniloop_wallets?select=user_id,shards&limit=100'),this.repo.request('/rest/v1/aniloop_admins?select=user_id'),this.repo.list('report:',100)]);const balance=new Map(wallets.map(x=>[x.user_id,x.shards]));return {accountCount:profiles.length,players:profiles.map(p=>({id:p.id,username:p.username,shards:balance.get(p.id)||0,role:admins.some(a=>a.user_id===p.id)?'admin':'none'})),reports:reports.map(r=>({...r.value,id:r.key.slice(7)})),pictures:await this.pendingPictures(new Map(profiles.map(p=>[p.id,p.username])))};}
 async pendingPictures(names){if(typeof this.repo.pendingPictures!=='function')return [];const rows=await this.repo.pendingPictures(50).catch(()=>[]);return rows.map(r=>({userId:r.owner_id,username:names.get(r.owner_id)||'Player',pictureUrl:r.picture?`data:image/${r.pictureType||'png'};base64,${r.picture}`:null})).filter(r=>r.pictureUrl);}
 async adminAction(actor,payload){check(await this.repo.isAdmin(actor),'Administrator access required.',403);if(payload.action==='set-shards'){check(validId(payload.userId)&&Number.isSafeInteger(payload.shards)&&payload.shards>=0&&payload.shards<=1_000_000_000,'Invalid shard balance.');return transaction(this.repo,actor,async tx=>{const a=await tx.get('account:'+payload.userId)||{shards:0,equipped:'classic',owned:[],claims:[],scores:[],picture:null};a.shards=payload.shards;tx.admin=true;await tx.put('account:'+payload.userId,a,payload.userId);return {ok:true};});}if(payload.action==='delete-report'){const key='report:'+cleanText(payload.reportId,80);return transaction(this.repo,actor,async tx=>{check(await tx.get(key),'Report not found.',404);tx.admin=true;await tx.remove(key);return {ok:true};});}if(payload.action==='picture-approve'||payload.action==='picture-reject'){check(validId(payload.userId),'Choose a player.');return transaction(this.repo,actor,async tx=>{const a=await tx.get('account:'+payload.userId);check(a?.picture,'This player has no profile picture.',404);if(payload.action==='picture-approve')a.pictureStatus='approved';else Object.assign(a,{picture:null,pictureType:null,pictureStatus:null});tx.admin=true;await tx.put('account:'+payload.userId,a,payload.userId);return {ok:true};});}throw new GameError('Unknown administrator action.');}
}

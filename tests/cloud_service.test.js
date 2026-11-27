import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CloudService} from '../cloud/service.js';
import {CATEGORIES,createSession} from '../core.js';
import {GameError} from '../cloud/engine.js';

const pack=JSON.parse(readFileSync(new URL('../data/pool.json',import.meta.url)));
const users={one:'8f27a733-7b4a-43c0-9a58-42f8d513df20',two:'b32bfc2c-96e7-4fc8-9b25-c14e20116eab'};
class FakeRepo{
 constructor(){this.docs=new Map();this.profiles=new Map([[users.one,{id:users.one,username:'Insider'}],[users.two,{id:users.two,username:'Kitsune'}]]);this.admins=new Set([users.one]);this.scores=[];}
 profile(id){return Promise.resolve(this.profiles.get(id)||null);}
 findProfile(username){return Promise.resolve([...this.profiles.values()].find(p=>p.username===username)||null);}
 isAdmin(id){return Promise.resolve(this.admins.has(id));}
 getRuntime(key){const row=this.docs.get(key);return Promise.resolve(row?{key,...structuredClone(row)}:null);}
 transaction(actor){return new FakeTransaction(this,actor);}
 async scoreRows(ids,mode,since){return this.scores.filter(x=>ids.includes(x.user||x.actor||x.user_id)&&x.mode===mode).map(x=>({user_id:x.user||x.actor||x.user_id,score:x.score,created_at:x.created||'2026-01-01T00:00:00Z'}));}
 async request(path,payload){if(path.includes('friend_scores')){const ids=payload.p_ids;return ids.map(id=>({id,bestInfinity:null,infinityRounds:0,daily:[]}));}throw new Error('Unexpected repository request: '+path);}
}
class FakeTransaction{
 constructor(repo,actor){this.repo=repo;this.actor=actor;this.reads=new Map();this.writes=new Map();this.score=null;this.admin=false;}
 async get(key){if(this.writes.has(key))return this.writes.get(key).delete?null:structuredClone(this.writes.get(key).value);if(!this.reads.has(key)){const row=this.repo.docs.get(key);this.reads.set(key,{revision:row?.revision||0,value:row?.value??null});}return structuredClone(this.reads.get(key).value);}
 async put(key,value,owner){await this.get(key);this.writes.set(key,{value:structuredClone(value),owner});}
 async remove(key){await this.get(key);this.writes.set(key,{delete:true});}
 async commit(){for(const [key,row]of this.reads)if((this.repo.docs.get(key)?.revision||0)!==row.revision)return false;if(this.admin)assert.ok(this.repo.admins.has(this.actor));for(const [key,value]of this.writes){if(value.delete)this.repo.docs.delete(key);else this.repo.docs.set(key,{value:value.value,owner:value.owner,revision:(this.repo.docs.get(key)?.revision||0)+1});}if(this.score){if(this.repo.scores.some(x=>x.actor===this.actor&&x.mode===this.score.mode&&x.seed===this.score.seed))throw new GameError('This record already exists.',409);this.repo.scores.push({actor:this.actor,...this.score});}return true;}
}
function validRun(){
 const anime=pack.anime,games={};
 for(const category of ['screenshot','opening','ending']){const selected=anime.filter(a=>category==='screenshot'?a.screenshots?.length:a[category]?.audio||a[category]?.video).slice(0,3);games[category]={done:true,questions:selected.map(a=>a.id),answers:selected.map(a=>({value:a.title,hints:[]}))};}
 const chars=anime.flatMap(a=>(a.characters||[]).map(c=>({a,c}))).slice(0,4);games.character={done:true,questions:[0,1,2].map(()=>chars.map(x=>x.a.id)),characterRefs:[0,1,2].map(()=>chars.map(x=>x.c.id)),answers:[0,1,2].map(()=>({entries:chars.map(({a,c})=>({characterValue:c.name,animeValue:a.title}))}))};
 const target=anime.find(a=>a.synopsis&&a.popularCharacter);games.anidle={done:true,questions:[target.id],guesses:[{id:target.id,attempt:1}],answers:[{value:target.title,attempt:1}]};
 return {mode:'infinity',seed:'cloud-test-'+crypto.randomUUID(),packKey:pack.key,games};
}

test('scores are recalculated, deduplicated, and account save rows stay private',async()=>{
 const repo=new FakeRepo(),api=new CloudService(repo,pack),run=validRun();
 for(const g of Object.values(run.games))g.scores=[999999999];
 const result=await api.submit(users.one,run);assert.equal(result.score,100000);assert.equal(repo.scores[0].score,100000);
 await assert.rejects(api.submit(users.one,run),/already|exists/i);
 await api.save(users.one,{state:{version:1,infinity:{seed:'private'}}},false);
 assert.equal((await api.save(users.one,{},true)).state.infinity.seed,'private');
 assert.equal((await api.save(users.two,{},true)).state,null);
});

test('shard purchases run on the trusted service and cannot go below zero',async()=>{
 const repo=new FakeRepo(),api=new CloudService(repo,pack);
 await assert.rejects(api.cosmetic(users.two,'lunar',false),/Not enough/);
 repo.docs.set('account:'+users.one,{value:{shards:1000,equipped:'classic',owned:[],claims:[],scores:[],picture:null},revision:1,owner:users.one});
 const result=await api.cosmetic(users.one,'orbit',false);assert.equal(result.rewards.balance,500);assert.deepEqual(result.rewards.owned,['orbit']);
 await assert.rejects(api.cosmetic(users.one,'lunar',false),/Not enough/);
});

test('room membership and answer state are isolated by player',async()=>{
 const repo=new FakeRepo(),api=new CloudService(repo,pack);
 const created=await api.createRoom(users.one,repo.profiles.get(users.one),'party'),code=created.room.code;
 await api.joinRoom(users.two,repo.profiles.get(users.two),code);
 const room=(await api.roomGet(users.one,code)).room;
 await api.roomMutate(users.one,code,{action:'start',revision:room.revision});
 const first=(await api.roomGet(users.one,code)).room,second=(await api.roomGet(users.two,code)).room;
 assert.equal(first.phase,'playing');assert.equal(first.session.mode,'infinity');assert.notEqual(first.session,second.session);
 assert.equal((await api.roomCurrent(users.two)).room.code,code);
 await assert.rejects(api.roomGet('ffffffff-ffff-ffff-ffff-ffffffffffff',code),/Join this room/);
});

test('room roster shows approved pictures and keeps pending pictures private',async()=>{
 const repo=new FakeRepo(),api=new CloudService(repo,pack);
 const base={shards:0,equipped:'classic',owned:[],claims:[],scores:[],picture:'iVBORw0KGgoAAA',pictureType:'png'};
 repo.docs.set('account:'+users.one,{value:{...base,pictureStatus:'pending'},revision:1,owner:users.one});
 repo.docs.set('account:'+users.two,{value:{...base,pictureStatus:'approved'},revision:1,owner:users.two});
 const created=await api.createRoom(users.one,repo.profiles.get(users.one),'party');
 await api.joinRoom(users.two,repo.profiles.get(users.two),created.room.code);
 const view=await api.roomLooks(await api.roomGet(users.one,created.room.code),users.one);
 assert.ok(view.room.players.find(p=>p.id===users.one).pictureUrl);
 assert.ok(view.room.players.find(p=>p.id===users.two).pictureUrl);
 const other=await api.roomLooks(await api.roomGet(users.two,created.room.code),users.two);
 assert.equal(other.room.players.find(p=>p.id===users.one).pictureUrl,null);
});

test('profile picture accepts browser-prepared PNG data URLs and remains private',async()=>{
 const repo=new FakeRepo(),api=new CloudService(repo,pack);
 const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';
 const saved=await api.picture(users.one,{image});
 assert.equal(saved.pictureUrl,image);
 assert.equal((await api.current(users.one,{email:'private@example.com'})).user.pictureUrl,image);
 assert.equal((await api.current(users.two,{email:'other@example.com'})).user.pictureUrl,null);
 await assert.rejects(api.picture(users.one,{image:'data:image/png;base64,not-a-png'}),/could not be saved/);
 assert.equal((await api.picture(users.one,{image:null})).hasPicture,false);
});

function answerDaily(g,category,index){
 const catalog=new Map(pack.anime.map(a=>[a.id,a]));
 if(category==='character')return {entries:g.questions[index].map((id,j)=>{const a=catalog.get(id),c=a.characters.find(c=>c.id===g.characterRefs[index][j]);return {characterValue:c.name,animeValue:a.title};})};
 return {value:catalog.get(g.questions[index]).title};
}

test('daily quiz is secret-seeded, the same for everyone and limited to one server-side attempt',async()=>{
 const repo=new FakeRepo();
 await assert.rejects(new CloudService(repo,pack).daily(users.one),/not configured/);
 const api=new CloudService(repo,pack,{dailySecret:'test-secret'});
 const first=await api.daily(users.one),second=await api.daily(users.two);
 assert.deepEqual(first.session.games,second.session.games);
 const publicSeed=createSession('daily',first.day,`${first.day}:${pack.key}`,pack.anime,pack.key);
 assert.notDeepEqual(publicSeed.games.screenshot.questions,first.session.games.screenshot.questions);
 const rotated=await new CloudService(new FakeRepo(),pack,{dailySecret:'another-secret'}).daily(users.one);
 assert.notDeepEqual(rotated.session.games.screenshot.questions,first.session.games.screenshot.questions);
 assert.equal(first.session.seed,first.day);

 await api.dailyAct(users.one,{category:'screenshot',index:0,action:'giveup'});
 assert.equal((await api.daily(users.one)).session.games.screenshot.scores.length,1,'reloading keeps the attempt');
 await assert.rejects(api.dailyAct(users.one,{category:'screenshot',index:0,action:'giveup'}),/already finished/);
 await assert.rejects(api.dailyAct(users.one,{category:'screenshot',index:1,action:'answer',value:'x'}),/another tab/);
 await assert.rejects(api.dailyAct(users.one,{category:'screenshot',index:0,action:'hint',number:1}),/already finished/);
 await assert.rejects(api.submit(users.one,{...validRun(),mode:'daily',seed:first.day}),/saved automatically/);

 let result;
 for(const {id:category,rounds} of CATEGORIES){
  for(let i=0;i<rounds;i++){
   let g=(await api.daily(users.one)).session.games[category];
   if(g.scores.length<=i)result=await api.dailyAct(users.one,{category,index:i,action:'answer',...answerDaily(g,category,i)});
   g=(await api.daily(users.one)).session.games[category];
   if(category==='anidle'&&!g.done)result=await api.dailyAct(users.one,{category,index:0,action:'giveup'});
   if(i<rounds-1)result=await api.dailyAct(users.one,{category,index:i,action:'continue'});
  }
 }
 assert.equal(result.finished,true);
 assert.equal(result.earned,100);
 assert.equal(result.rewards.claimedToday,true);
 const games=result.session.games;
 assert.deepEqual(games.screenshot.scores.slice(1),[10000,10000]);
 assert.equal(games.character.scores.reduce((a,b)=>a+b,0),30000);
 assert.equal(repo.scores.length,1);assert.equal(repo.scores[0].mode,'daily');assert.equal(repo.scores[0].seed,first.day);assert.equal(repo.scores[0].score,result.score);
 await assert.rejects(api.claim(users.one),/already been claimed/);
 const otherPlayer=await api.daily(users.two);assert.equal(otherPlayer.session.games.screenshot.scores.length,0,'attempts are per account');
});

test('profile pictures must pass the safety filter before friends can see them',async()=>{
 const repo=new FakeRepo(),jpeg='data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD';
 const blocked=new CloudService(repo,pack,{moderateImage:async()=>({status:'rejected'})});
 await assert.rejects(blocked.picture(users.one,{image:jpeg}),/safety filter/);
 assert.equal((await blocked.current(users.one,{email:'one@example.com'})).user.hasPicture,false);
 const manual=new CloudService(repo,pack);
 assert.equal((await manual.picture(users.one,{image:jpeg})).pictureStatus,'pending');
 await manual.friendChange(users.one,'request',{username:'Kitsune'});
 let view=await manual.friends(users.two);assert.equal(view.incoming[0].pictureUrl,null);
 await manual.friendChange(users.two,'accept',{userId:users.one});
 view=await manual.friends(users.two);assert.equal(view.players.find(p=>p.userId===users.one).pictureUrl,null);
 const checked=new CloudService(repo,pack,{moderateImage:async()=>({status:'approved'})});
 assert.equal((await checked.picture(users.one,{image:jpeg})).pictureStatus,'approved');
 view=await checked.friends(users.two);assert.equal(view.players.find(p=>p.userId===users.one).pictureUrl,jpeg);
 assert.equal((await checked.friends(users.one)).players.find(p=>p.isSelf).pictureUrl,jpeg);
 const broken=new CloudService(repo,pack,{moderateImage:async()=>{throw new Error('offline');}});
 assert.equal((await broken.picture(users.one,{image:jpeg})).pictureStatus,'pending','filter outages fail closed');
 view=await broken.friends(users.two);assert.equal(view.players.find(p=>p.userId===users.one).pictureUrl,null);
 await assert.rejects(checked.picture(users.one,{image:'data:image/jpeg;base64,iVBORw0KGgo'}),/could not be saved/);
});

test('a flagged picture can be reviewed without replacing the current picture',async()=>{
 const repo=new FakeRepo(),api=new CloudService(repo,pack,{moderateImage:async()=>({status:'rejected'})});
 const old='iVBORw0KGgoOLD',image='data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD';
 repo.docs.set('account:'+users.two,{value:{shards:0,equipped:'classic',owned:[],claims:[],scores:[],picture:old,pictureType:'png',pictureStatus:'approved'},revision:1,owner:users.two});
 await assert.rejects(api.picture(users.two,{image}),/safety filter/);
 assert.equal(repo.docs.get('account:'+users.two).value.picture,old);
 assert.equal((await api.picture(users.two,{image,manualReview:true})).submitted,true);
 const review=repo.docs.get('picture-review:'+users.two).value;
 assert.equal(repo.docs.get('account:'+users.two).value.picture,old);
 await assert.rejects(api.adminAction(users.two,{action:'picture-review-approve',userId:users.two,reviewId:review.id}),/Administrator/);
 await api.adminAction(users.one,{action:'picture-review-approve',userId:users.two,reviewId:review.id});
 assert.equal(repo.docs.get('account:'+users.two).value.pictureStatus,'approved');
 assert.equal(repo.docs.get('account:'+users.two).value.pictureType,'jpeg');
 assert.equal(repo.docs.has('picture-review:'+users.two),false);
 await assert.rejects(api.adminAction(users.one,{action:'picture-review-approve',userId:users.two,reviewId:review.id}),/replaced|handled/);
});

test('friends leaderboard ranks only you and accepted friends, with frames and approved pictures',async()=>{
 const repo=new FakeRepo(),api=new CloudService(repo,pack,{moderateImage:async()=>({status:'approved'})});
 await assert.rejects(api.leaderboard(new URLSearchParams('scope=friends'),null),/Sign in/);
 await api.friendChange(users.one,'request',{username:'Kitsune'});
 let board=await api.leaderboard(new URLSearchParams('scope=friends&mode=infinity'),users.one);
 assert.deepEqual(board.entries.map(e=>e.userId),[users.one],'pending friends are not on the board');
 await api.friendChange(users.two,'accept',{userId:users.one});
 const run=validRun();await api.submit(users.two,run);
 repo.docs.set('account:'+users.two,{value:{...repo.docs.get('account:'+users.two)?.value,shards:0,equipped:'galaxy',owned:['galaxy'],claims:[],scores:[],picture:'/9j/4AAQ',pictureType:'jpeg',pictureStatus:'approved'},revision:9,owner:users.two});
 board=await api.leaderboard(new URLSearchParams('scope=friends&mode=infinity'),users.one);
 assert.equal(board.entries[0].userId,users.two);assert.equal(board.entries[0].rank,1);assert.equal(board.entries[0].frame,'galaxy');
 assert.equal(board.entries[0].pictureUrl,'data:image/jpeg;base64,/9j/4AAQ');
 assert.equal(board.entries[1].userId,users.one);assert.equal(board.entries[1].score,null);assert.equal(board.entries[1].rank,null);
});

test('stored private pictures can be shared later and failed checks explain why',async()=>{
 const repo=new FakeRepo();
 repo.docs.set('account:'+users.one,{value:{shards:0,equipped:'classic',owned:[],claims:[],scores:[],picture:'iVBORw0KGgoAAAA'},revision:1,owner:users.one});
 const offline=new CloudService(repo,pack);
 assert.equal((await offline.current(users.one,{email:'a@example.com'})).user.pictureStatus,'private');
 const pending=await offline.picture(users.one,{share:true});
 assert.equal(pending.pictureStatus,'pending');assert.equal(pending.pictureCheck,'not-configured');
 const quota=new CloudService(repo,pack,{moderateImage:async()=>({status:'pending',reason:'openai-429'})});
 assert.equal((await quota.picture(users.one,{share:true})).pictureCheck,'openai-429');
 const ok=new CloudService(repo,pack,{moderateImage:async()=>({status:'approved',reason:null})});
 const shared=await ok.picture(users.one,{share:true});assert.equal(shared.pictureStatus,'approved');assert.equal(shared.pictureCheck,null);
 const blocked=new CloudService(repo,pack,{moderateImage:async()=>({status:'rejected'})});
 repo.docs.set('account:'+users.two,{value:{shards:0,equipped:'classic',owned:[],claims:[],scores:[],picture:'iVBORw0KGgoBBBB'},revision:1,owner:users.two});
 await assert.rejects(blocked.picture(users.two,{share:true}),/blocked/);
 assert.equal((await blocked.current(users.two,{email:'b@example.com'})).user.hasPicture,false);
});

test('new premium frames can be bought and equipped',async()=>{
 const repo=new FakeRepo(),api=new CloudService(repo,pack);
 repo.docs.set('account:'+users.one,{value:{shards:5000,equipped:'classic',owned:[],claims:[],scores:[],picture:null},revision:1,owner:users.one});
 const result=await api.cosmetic(users.one,'galaxy',false);
 assert.equal(result.rewards.balance,2000);assert.equal(result.rewards.equipped,'galaxy');
 await assert.rejects(api.cosmetic(users.one,'holo',true),/Unlock/);
});

test('titles, name colours, banners and effects use their own slots and show to friends',async()=>{
 const repo=new FakeRepo(),api=new CloudService(repo,pack);
 repo.docs.set('account:'+users.two,{value:{shards:6000,equipped:'classic',owned:[],claims:[],scores:[],picture:null},revision:1,owner:users.two});
 await api.cosmetic(users.two,'title-legend',false);await api.cosmetic(users.two,'name-aurora',false);
 const bought=await api.cosmetic(users.two,'banner-stars',false);
 assert.deepEqual(bought.rewards.slots,{title:'title-legend',name:'name-aurora',banner:'banner-stars',effect:null});
 assert.equal(bought.rewards.equipped,'classic','slot items never replace the frame');
 await assert.rejects(api.cosmetic(users.two,'effect-fireworks',true),/Unlock/);
 await assert.rejects(api.cosmetic(users.two,'title-fake',false),/Unknown cosmetic/);
 const cleared=await api.cosmetic(users.two,'name-none',true);assert.equal(cleared.rewards.slots.name,null);
 await api.cosmetic(users.two,'name-aurora',true);
 await api.friendChange(users.one,'request',{username:'Kitsune'});await api.friendChange(users.two,'accept',{userId:users.one});
 const friend=(await api.friends(users.one)).players.find(p=>p.userId===users.two);
 assert.equal(friend.title,'title-legend');assert.equal(friend.nameStyle,'name-aurora');assert.equal(friend.banner,'banner-stars');
});

test('theme and backdrop are saved with the account and come back on sign-in',async()=>{
 const repo=new FakeRepo(),api=new CloudService(repo,pack);
 repo.docs.set('account:'+users.one,{value:{shards:0,equipped:'classic',owned:[],claims:[],scores:[],picture:null},revision:1,owner:users.one});
 const saved=await api.saveAppearance(users.one,{theme:'sakura',background:'nebula',dim:200,inGame:true,position:'top',savedAt:1});
 assert.equal(saved.appearance.theme,'sakura');assert.equal(saved.appearance.dim,90);assert.ok(saved.appearance.savedAt>1,'the server sets the time');
 const again=await api.saveAppearance(users.one,{theme:'ocean',background:'none'});assert.ok(again.appearance.savedAt>saved.appearance.savedAt);
 await assert.rejects(api.saveAppearance(users.one,{theme:'url(x)',background:'none'}),/Invalid appearance/);
 assert.equal(repo.docs.get('account:'+users.one).value.appearance.theme,'ocean');
});

test('administrators can give and take cosmetics, adjust shards and moderate pictures',async()=>{
 const repo=new FakeRepo(),api=new CloudService(repo,pack);
 repo.docs.set('account:'+users.two,{value:{shards:100,equipped:'galaxy',owned:['galaxy'],slots:{title:'title-legend'},claims:[],scores:[],picture:'AAAA',pictureType:'jpeg',pictureStatus:'pending'},revision:1,owner:users.two});
 repo.pendingPictures=async()=>[{owner_id:users.two,picture:'AAAA',pictureType:'jpeg'}];
 await api.adminAction(users.one,{action:'grant-item',userId:users.two,item:'title-legend'});
 await api.adminAction(users.one,{action:'revoke-item',userId:users.two,item:'galaxy'});
 let a=repo.docs.get('account:'+users.two).value;assert.deepEqual(a.owned,['title-legend']);assert.equal(a.equipped,'classic');
 await assert.rejects(api.adminAction(users.one,{action:'grant-item',userId:users.two,item:'nope'}),/Unknown cosmetic/);
 const added=await api.adminAction(users.one,{action:'add-shards',userId:users.two,amount:-500});assert.equal(added.shards,0);
 const result=await api.adminAction(users.one,{action:'picture-approve-all'});assert.equal(result.approved,1);
 assert.equal(repo.docs.get('account:'+users.two).value.pictureStatus,'approved');
 await api.adminAction(users.one,{action:'remove-picture',userId:users.two});assert.equal(repo.docs.get('account:'+users.two).value.picture,null);
 await assert.rejects(api.adminAction(users.two,{action:'grant-item',userId:users.two,item:'galaxy'}),/Administrator access required/);
 await assert.rejects(api.adminAction(users.one,{action:'set-admin',userId:users.one,admin:false}),/your own/);
});

test('administrators can see today’s daily answers, players cannot',async()=>{
 const repo=new FakeRepo(),api=new CloudService(repo,pack,{dailySecret:'test-secret'});
 const answers=await api.adminDailyAnswers(users.one);
 const mine=await api.daily(users.two);
 assert.equal(answers.categories.find(c=>c.id==='screenshot').rounds.length,3);
 const firstId=mine.session?.games?.screenshot?.questions?.[0];
 if(firstId){const a=pack.anime.find(x=>x.id===firstId);assert.equal(answers.categories.find(c=>c.id==='screenshot').rounds[0].anime,a.englishTitle||a.alternativeTitle||a.title);}
 assert.equal(answers.categories.find(c=>c.id==='character').rounds[0].characters.length,4);
 await assert.rejects(api.adminDailyAnswers(users.two),/Administrator access required/);
});

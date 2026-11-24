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

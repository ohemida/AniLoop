import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CloudService} from '../cloud/service.js';
import {CATEGORIES} from '../core.js';
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

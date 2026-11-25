// Trusted game rules shared by the Edge Function and isolated Node tests.
import {CATEGORIES,createSession,totalScore,roundScore} from '../core.js';
export class GameError extends Error{constructor(message,status=400){super(message);this.status=status;}}
export function check(ok,message,status=400){if(!ok)throw new GameError(message,status);}
export const clone=value=>structuredClone(value);
export const today=()=>new Date().toISOString().slice(0,10);
export const timestamp=()=>Math.floor(Date.now()/1000);
export const normalize=v=>String(v??'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export const matches=(value,options)=>!!normalize(value)&&options.some(v=>normalize(v)===normalize(value));
export const titleMatches=(value,a)=>matches(value,[a.title,...(a.aliases||[])]);
export const COSMETICS=[['silver','Silver lining',250],['orbit','Mauve orbit',500],['starlit','Starlit loop',1000],['fern','Night bloom',450],['ink','Ink panel',750],['lunar','Lunar arc',1250],['sakura','Sakura drift',900],['neon','Neon pulse',1500],['ember','Ember crown',1750],['aurora','Aurora veil',2000],['holo','Holo foil',2500],['galaxy','Galaxy loop',3000]].map(([id,name,price])=>({id,name,price,description:'A cosmetic profile frame.'}));
export function recalculate(run,pack){
 check(run&&run.packKey===pack.key,'Only complete rounds from the default pool can enter the leaderboard.');
 let {mode,seed}=run;check(['daily','infinity'].includes(mode)&&typeof seed==='string'&&seed.length>0&&seed.length<=200,'Invalid round identity.');
 if(mode==='daily'){seed=seed.split(':')[0];check(/^\d{4}-\d{2}-\d{2}$/.test(seed)&&Math.abs(Date.parse(seed)-Date.parse(today()))<=86400000,'Only the current daily quiz can be submitted.');}
 const catalog=new Map(pack.anime.map(a=>[a.id,a])),breakdown={};
 try{for(const {id:category,rounds} of CATEGORIES){
  const g=run.games[category];check(g?.done===true&&g.questions.length===rounds&&g.answers.length===rounds,'This round is incomplete.');let sum=0;
  for(let i=0;i<rounds;i++){
   const answer=g.answers[i];check(answer&&typeof answer==='object','Invalid answer history.');
   if(category==='character'){
    check(g.questions[i].length===4&&g.characterRefs[i].length===4&&answer.entries.length===4,'Provide four character answers.');
    for(let j=0;j<4;j++){const a=catalog.get(g.questions[i][j]),c=a.characters.find(c=>c.id===g.characterRefs[i][j]),e=answer.entries[j];check(c&&e,'Invalid character reference.');sum+=(matches(e.characterValue,[c.name,...(c.aliases||[])])?2000:0)+(titleMatches(e.animeValue,a)?500:0);}
   }else{
    const a=catalog.get(g.questions[i]);check(a&&(category==='anidle'||(category==='screenshot'?a.screenshots?.length:a[category])),'Invalid question reference.');
    if(category==='anidle'){
     check(Number.isInteger(answer.attempt)&&answer.attempt>=1&&answer.attempt<=22,'Invalid attempt.');const guesses=g.guesses||[];
     check(guesses.length<=answer.attempt&&guesses.every(x=>Number.isInteger(x.attempt)&&x.attempt>=1&&x.attempt<=answer.attempt),'Invalid guess history.');
     const correct=titleMatches(answer.value,a),last=guesses.at(-1);check(!correct||last?.id===a.id&&last.attempt===answer.attempt,'Invalid correct guess history.');sum+=roundScore(category,{correct,attempt:answer.attempt});
    }else{
     const allowed=category==='screenshot'?[[],[1],[1,2],[1,2,3]]:[[],[1]];check(allowed.some(h=>JSON.stringify(h)===JSON.stringify(answer.hints)),'Invalid hint history.');sum+=roundScore(category,{correct:titleMatches(answer.value,a),hints:answer.hints.length});
    }
   }
  }breakdown[category]=sum;
 }}catch(e){if(e instanceof GameError)throw e;throw new GameError('This round is incomplete or uses an older save format. Complete a new round.');}
 const score=Object.values(breakdown).reduce((a,b)=>a+b,0);check(score>=0&&score<=100000,'Invalid score.');return {mode,seed,score,breakdown,created:timestamp()};
}
export function newAccount(){return {shards:0,equipped:'classic',owned:[],scores:[],claims:[],picture:null};}
export function rewards(account){
 const rows=[...account.claims].sort((a,b)=>a.day.localeCompare(b.day));let best=0,chain=0,previous=null;
 for(const row of rows){chain=previous&&Date.parse(row.day)-Date.parse(previous)===86400000?chain+1:1;best=Math.max(best,chain);previous=row.day;}
 const date=today(),streak=previous&&Date.parse(previous)>=Date.parse(date)-86400000?chain:0;
 return {today:date,resetAt:new Date(Date.parse(date)+86400000).toISOString(),streak,bestStreak:best,claimedToday:rows.at(-1)?.day===date,balance:account.shards,equipped:account.equipped,owned:account.owned,history:rows.slice(-35),cosmetics:COSMETICS,milestones:[[3,'First spark'],[7,'Weekly regular'],[14,'Unbroken loop'],[30,'Daily devotee']].map(([days,name])=>({days,name,unlocked:best>=days}))};
}
export const STEPS=CATEGORIES.flatMap(c=>Array.from({length:c.rounds},(_,i)=>[c.id,i]));
export function roomView(room,userId){
 check(room.members.some(m=>m.id===userId),'Join this room before viewing it.',403);
 const s=room.state,[category,index]=STEPS[Math.min(s.step,STEPS.length-1)],session=s.phase==='lobby'?null:room.mode==='coop'?s.team:s.players[userId],g=session?.games[category];
 const ready=!!g&&g.scores.length>index;
 const players=room.members.map(m=>{const game=room.mode==='coop'?s.team:s.players?.[m.id];return {id:m.id,username:m.username,score:game?totalScore(game):0,ready:!!game&&game.games[category].scores.length>index,host:m.id===room.owner};});
 return {turn:g?`${s.loop}:${s.step}:${g.scores.length}:${g.attempt}:${g.hints.join(',')}`:null,code:room.code,mode:room.mode,hostId:room.owner,revision:room.revision,phase:s.phase,loop:s.loop,step:s.step,totalSteps:STEPS.length,category,questionIndex:index,session:clone(session),players,ready,allReady:room.mode==='coop'?ready:players.every(p=>p.ready),hintsRemaining:s.hintsRemaining,hintBudget:8,expiresAt:room.updated+86400};
}
export function makeRoom(code,user,mode){check(['party','coop'].includes(mode),'Choose Party or Co-op Infinity.');return {code,mode,owner:user.id,members:[{id:user.id,username:user.username,joined:timestamp()}],revision:1,updated:timestamp(),state:{phase:'lobby',step:0,loop:1,hintsRemaining:8}};}
export function answerRoom(g,category,index,data,pack,giveup){
 const catalog=new Map(pack.anime.map(a=>[a.id,a]));let score=0;const answer={value:'Gave up',hints:[...g.hints],attempt:g.attempt};
 if(category==='character'){
  const entries=giveup?Array.from({length:4},()=>({})):data.entries;check(Array.isArray(entries)&&entries.length===4,'Provide four character answers.');answer.entries=[];
  for(let j=0;j<4;j++){const a=catalog.get(g.questions[index][j]),c=a.characters.find(c=>c.id===g.characterRefs[index][j]),e=entries[j];check(e&&typeof e==='object','Invalid character answer.');const name=String(e.characterValue||'').slice(0,200),title=String(e.animeValue||'').slice(0,300),character=matches(name,[c.name,...(c.aliases||[])]),anime=titleMatches(title,a);score+=(character?2000:0)+(anime?500:0);answer.entries.push({character,anime,characterValue:name,animeValue:title});}
 }else if(!giveup){
  const value=data.value;check(typeof value==='string'&&value.trim()&&value.length<=300,'Enter an anime title.');
  const guess=pack.anime.find(a=>matches(value,[a.title]))||pack.anime.find(a=>titleMatches(value,a));check(guess,'Choose an anime from the suggestions.');const target=catalog.get(g.questions[index]),correct=category==='anidle'?guess.id===target.id:titleMatches(value,target);Object.assign(answer,{value:guess.title,correct});
  if(category==='anidle'){check(!g.guesses.some(x=>x.id===guess.id),'This anime has already been guessed.');g.guesses.push({id:guess.id,attempt:g.attempt});if(!correct&&g.attempt<22){g.attempt++;return;}}
  score=roundScore(category,{correct,hints:g.hints.length,attempt:g.attempt});
 }
 g.scores.push(score);g.answers.push(answer);g.done=g.scores.length===g.questions.length;
}
// Account-bound daily quiz: one server-side attempt per account and day.
// The client sends the question index it is looking at, so a stale tab or a
// double click can never answer the next question.
export function dailyAction(session,category,data,pack){
 check(CATEGORIES.some(c=>c.id===category),'Choose a quiz category.');
 const g=session.games[category],action=data?.action;
 check(Number.isInteger(data?.index)&&data.index===g.index,'The daily quiz changed in another tab. Reload and try again.',409);
 if(action==='continue'){check(!g.done&&g.scores.length>g.index,'Finish this question first.',409);g.index++;g.hints=[];return;}
 check(!g.done&&g.scores.length<=g.index,'This question is already finished.',409);
 if(action==='hint'){
  const n=data.number;check(Number.isInteger(n)&&(category==='screenshot'?[1,2,3]:['opening','ending'].includes(category)?[1]:[]).includes(n),'Invalid clue.');
  if(g.hints.includes(n))return;check(category!=='screenshot'||n===1||g.hints.includes(n-1),'Unlock clues in order.');g.hints.push(n);return;
 }
 if(action==='skip'){check(category==='anidle'&&g.attempt>3&&g.attempt<22,'No clue can be skipped to right now.');g.attempt=[13,18,22].find(n=>n>g.attempt);return;}
 if(action==='answer'||action==='giveup'){answerRoom(g,category,g.index,data,pack,action==='giveup');return;}
 throw new GameError('Unknown daily action.');
}
export function roomAction(room,userId,data,pack){
 const s=room.state,action=data.action;check(room.members.some(m=>m.id===userId),'Join this room before viewing it.',403);
 if(action==='leave'){room.members=room.members.filter(m=>m.id!==userId);if(s.players)delete s.players[userId];if(room.owner===userId)room.owner=room.members[0]?.id;}
 else{
  const snapshot=roomView(room,userId),turnUnchanged=['hint','skip','answer','giveup'].includes(action)&&s.phase==='playing'&&data.turn===snapshot.turn;
  check(data.revision===room.revision||turnUnchanged,'The room changed. Refresh and try again.',409);
  if(['start','next','next-loop','kick'].includes(action))check(room.owner===userId,'Only the host can advance or manage the room.',403);
  if(action==='kick'){check(data.userId!==userId&&room.members.some(m=>m.id===data.userId),'Choose another room member.');room.members=room.members.filter(m=>m.id!==data.userId);if(s.players)delete s.players[data.userId];}
  else if(action==='start'||action==='next-loop'){
   check(action==='start'?s.phase==='lobby':s.phase==='complete','The room is not ready for this action.',409);check(room.members.length>=2,'Invite at least one other player before starting.');const loop=action==='start'?1:s.loop+1,template=createSession('infinity',loop,crypto.randomUUID(),pack.anime,pack.key,s.template);
   Object.assign(s,{phase:'playing',step:0,loop,template,team:clone(template),players:Object.fromEntries(room.members.map(m=>[m.id,clone(template)])),hintsRemaining:8});
  }else if(action==='next'){
   check(s.phase==='playing'&&snapshot.allReady,'Wait until everyone has finished this question.',409);
   if(s.step===STEPS.length-1)s.phase='complete';else{s.step++;const [category,index]=STEPS[s.step];for(const session of [s.team,...Object.values(s.players)])Object.assign(session.games[category],{index,hints:[],activeFrame:0,musicMode:'audio'});}
  }else{
   check(s.phase==='playing','The host must start the room first.',409);const [category,index]=STEPS[s.step],session=room.mode==='coop'?s.team:s.players[userId],g=session.games[category];check(g.scores.length<=index,'This question is already finished.',409);
   if(action==='hint'){
    const n=data.number;check(Number.isInteger(n)&&(category==='screenshot'?[1,2,3]:['opening','ending'].includes(category)?[1]:[]).includes(n),'Invalid clue.');if(g.hints.includes(n))return room;
    check(category!=='screenshot'||n===1||g.hints.includes(n-1),'Unlock clues in order.');if(room.mode==='coop'){check(s.hintsRemaining>0,'Your team has used all eight hints for this loop.',409);s.hintsRemaining--;}g.hints.push(n);
   }else if(action==='skip'){check(category==='anidle'&&g.attempt>3&&g.attempt<22,'No clue can be skipped to right now.');g.attempt=[13,18,22].find(n=>n>g.attempt);}
   else if(['answer','giveup'].includes(action))answerRoom(g,category,index,data,pack,action==='giveup');else throw new GameError('Unknown room action.');
  }
 }
 room.revision++;room.updated=timestamp();return room;
}

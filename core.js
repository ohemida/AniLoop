export const CATEGORIES = [
  {id:'screenshot', name:'Screenshots', verb:'Guess the anime', icon:'▧', max:30000, rounds:3, description:'A single scene. Which anime is it?'},
  {id:'character', name:'Characters', verb:'Name the characters', icon:'♙', max:30000, rounds:3, description:'Familiar faces. Can you name them?'},
  {id:'opening', name:'Openings', verb:'Guess the opening', icon:'♫', max:15000, rounds:3, description:'You know the tune. Find the anime.'},
  {id:'ending', name:'Endings', verb:'Guess the ending', icon:'♪', max:15000, rounds:3, description:'The credits roll. Keep guessing.'},
  {id:'anidle', name:'Anidle', verb:'Find the anime', icon:'◈', max:10000, rounds:1, description:'Follow the year, studio, and tags to the answer.'}
];
export const MAX_SCORE = 100000;
export function dayKey(date=new Date()) {return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
export function rng(seed) {let a=2166136261; for(const c of String(seed)) a=Math.imul(a^c.charCodeAt(0),16777619); return ()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
export function shuffled(items, random) {const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export const LEVELS = ['Easy','Medium','Hard'];
export function eligible(entry,category) {
 if(category==='screenshot') return Boolean(entry.screenshots?.length);
 if(category==='character') return Boolean(entry.characters?.length||entry.characterImage&&entry.character);
 if(category==='opening'||category==='ending') return Boolean(entry[category]?.audio||entry[category]?.video||entry[category]?.demo);
 return Number.isFinite(entry.year)&&Number.isFinite(entry.score)&&Boolean(entry.studio)&&Boolean(entry.source)&&Boolean(entry.genres?.length)&&Boolean(entry.cover)&&Boolean(entry.synopsis||entry.hasSynopsis)&&Boolean(entry.popularCharacter);
}
export function poolCounts(entries) {return Object.fromEntries(CATEGORIES.map(c=>[c.id,LEVELS.map(level=>c.id==='character'?new Set(entries.flatMap(a=>(a.characters||[]).filter(v=>v.difficulty===level).map(v=>v.id))).size:entries.filter(a=>eligible(a,c.id)&&(a[c.id]?.difficulty||a.difficulty?.[c.id])===level).length)]));}
export function createSession(mode, number, seed, items, packKey='starter', previous=null) {
 const entries=items.map(item=>typeof item==='string'?{id:item}:item), ids=entries.map(a=>a.id);
 if(ids.length<4 || new Set(ids).size!==ids.length) throw new Error('At least four unique anime are required.');
 const real=items.some(a=>typeof a==='object'&&a.difficulty), random=rng(seed), games={};
 const pick=(values,count,avoid=[])=>{
  const fresh=shuffled(values.filter(v=>!avoid.includes(v.id)),random),old=shuffled(values.filter(v=>avoid.includes(v.id)),random),pool=[...fresh,...old];
  if(pool.length<count)throw new Error('The media pool has too few matching questions.');return pool.slice(0,count);
 };
 for(const c of CATEGORIES) {
  const old=previous?.games?.[c.id],avoid=old?.questions.flat()||[];
  let questions,characterRefs=[],frames=[],levels=[];
  if(!real){const selected=shuffled(ids,random);questions=Array.from({length:c.rounds},(_,i)=>c.id==='character'?Array.from({length:4},(_,j)=>selected[(i*4+j)%ids.length]):selected[i%ids.length]);}
  else if(c.id==='character') {
   questions=LEVELS.map(level=>{
    let candidates=entries.flatMap(a=>(a.characters||[]).filter(v=>v.difficulty===level).map(v=>({id:v.id,animeId:a.id}))),used=old?.characterRefs?.flat()||[];
    const ordered=pick(candidates,candidates.length,used),chosen=[];
    for(const v of ordered)if(chosen.length<4&&!chosen.some(x=>x.animeId===v.animeId||x.id===v.id))chosen.push(v);
    for(const v of ordered)if(chosen.length<4&&!chosen.some(x=>x.id===v.id))chosen.push(v);
    if(chosen.length<4)throw new Error(`Too few characters for ${level}.`);
    characterRefs.push(chosen.map(v=>v.id));return chosen.map(v=>v.animeId);
   });levels=[...LEVELS];
  } else if(c.id==='anidle') {
   const valid=entries.filter(a=>eligible(a,c.id));questions=pick(valid,1,avoid).map(a=>a.id);levels=questions.map(id=>entries.find(a=>a.id===id).difficulty.anidle||'Medium');
  } else {
   questions=LEVELS.map(level=>pick(entries.filter(a=>eligible(a,c.id)&&(a[c.id]?.difficulty||a.difficulty?.[c.id])===level),1,avoid)[0].id);levels=[...LEVELS];
   if(c.id==='screenshot')frames=questions.map(id=>{const a=entries.find(a=>a.id===id);return shuffled(a.screenshots.map((_,i)=>i),random).slice(0,3);});
  }
  games[c.id]={questions,index:0,scores:[],answers:[],hints:[],guesses:[],attempt:1,done:false,levels,frames,characterRefs};
 }
 return {version:2,mode,number,seed,packKey,games,createdAt:new Date().toISOString()};
}
export function roundScore(category,{correct=false,hints=0,characters=[],attempt=1}={}) {
 if(category==='character') return characters.reduce((s,c)=>s+(c.character?2000:0)+(c.anime?500:0),0);
 if(!correct) return 0;
 if(category==='anidle') return Math.max(0,10000-Math.max(0,attempt-3)*500);
 return Math.max(0,(category==='screenshot'?10000:5000)-hints*2500);
}
export function totalScore(session) {return Object.values(session.games).reduce((s,g)=>s+g.scores.reduce((a,b)=>a+b,0),0);}
export function completedCount(session) {return CATEGORIES.filter(c=>session.games[c.id].done).length;}
export function canAdvance(session) {return session.mode==='infinity' && completedCount(session)===CATEGORIES.length;}
export function nextInfinity(session, ids, seed) {
 if(!canAdvance(session)) throw new Error('Complete all five categories first.');
 return createSession('infinity',session.number+1,seed,ids,session.packKey,session);
}
export function commitRound(session,category,score,answer) {
 const old=session.games[category];
 if(!old || old.done || old.scores.length>old.index) throw new Error('This question has already been submitted.');
 if(!Number.isInteger(score)||score<0||score>(category==='opening'||category==='ending'?5000:10000)) throw new Error('Invalid score.');
 old.scores.push(score); old.answers.push(answer);
 if(old.scores.length===old.questions.length) old.done=true;
 return session;
}
export function continueCategory(session,category) {
 const g=session.games[category];
 if(g.done||g.scores.length<=g.index) return false;
 g.index++;g.hints=[];g.activeFrame=0;g.musicMode='audio';return true;
}
export const normalize = value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export function matches(value,options) {return Boolean(normalize(value))&&options.some(x=>normalize(x)===normalize(value));}
export function compareAnime(guess,target) {
 return {year:Math.sign(target.year-guess.year),studio:guess.studio===target.studio,source:guess.source===target.source,score:Number.isFinite(target.score)&&Number.isFinite(guess.score)?Math.sign(Math.round(target.score*100)-Math.round(guess.score*100)):null,genres:guess.genres.map(value=>({value,match:target.genres.includes(value)})),tags:guess.tags.map(value=>({value,match:target.tags.includes(value)?'primary':(target.secondary||[]).includes(value)?'secondary':'none'}))};
}
export function clueTarget(attempt) {return attempt<13?13:attempt<18?18:attempt<22?22:null;}
export function skipAnidle(session) {const g=session.games.anidle;if(g.done||g.attempt<=3)return false;const target=clueTarget(g.attempt);if(!target)return false;g.attempt=target;return true;}

export function summarizeAnidle(guesses, entries, target) {
 const byId=new Map(entries.map(a=>[a.id,a]));
 const summary={year:{lower:null,upper:null,exact:null},score:{lower:null,upper:null,exact:null},studios:[],sources:[],genres:[],tags:[]};
 const add=(key,value)=>{if(value&&!summary[key].includes(value))summary[key].push(value);};
 const bound=(key,value,comparison,step)=>{
  if(!Number.isFinite(value)||comparison===null)return;
  const b=summary[key];
  if(comparison===0)b.exact=value;
  else if(comparison>0)b.lower=Math.max(b.lower??-Infinity,Math.round((value+step)*100)/100);
  else b.upper=Math.min(b.upper??Infinity,Math.round((value-step)*100)/100);
 };
 for(const guess of guesses){
  const a=byId.get(guess.id);if(!a)continue;
  const c=compareAnime(a,target);bound('year',a.year,c.year,1);bound('score',a.score,c.score,.01);
  if(c.studio)add('studios',a.studio);if(c.source)add('sources',a.source);
  c.genres.filter(t=>t.match).forEach(t=>add('genres',t.value));
  for(const tag of c.tags.filter(t=>t.match!=='none')){const existing=summary.tags.find(t=>t.value===tag.value);if(!existing)summary.tags.push(tag);else if(tag.match==='primary')existing.match='primary';}
 }
 return summary;
}

export function videoBounds(duration,window={}) {
 if(!Number.isFinite(duration)||duration<=0)return {start:0,end:0};
 const start=Math.max(0,Math.min(duration,Number.isFinite(window.startSeconds)?window.startSeconds:duration*(window.startFraction??.35)));
 const end=Math.max(0,Math.min(duration,Number.isFinite(window.endSeconds)?window.endSeconds:duration*(window.endFraction??.65)));
 if(end<=start)throw new Error('The video window ends before it starts.');
 return {start,end};
}

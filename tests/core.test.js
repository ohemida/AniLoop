import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CATEGORIES,createSession,canAdvance,nextInfinity,commitRound,continueCategory,totalScore,roundScore,compareAnime,skipAnidle,matches,dayKey} from '../core.js';
import {validatePack} from '../storage.js';
const pack=JSON.parse(readFileSync(new URL('../data/starter.json',import.meta.url)));
const ids=pack.anime.map(a=>a.id);
const make=(seed='first')=>createSession('infinity',1,seed,ids);
function complete(s,c){for(let i=0;i<c.rounds;i++){commitRound(s,c.id,c.id==='opening'||c.id==='ending'?5000:10000,{});continueCategory(s,c.id);}}
test('Infinity stays locked until all five categories finish',()=>{const s=make();for(const c of CATEGORIES){assert.equal(canAdvance(s),false);assert.throws(()=>nextInfinity(s,ids,'next'),/five/);complete(s,c);}assert.equal(canAdvance(s),true);assert.equal(totalScore(s),100000);const next=nextInfinity(s,ids,'next');assert.equal(next.number,2);assert.equal(canAdvance(next),false);assert.equal(totalScore(next),0);assert.notDeepEqual(next.games,s.games);});
test('Duplicate submissions cannot overwrite scores',()=>{const s=make();commitRound(s,'screenshot',7500,{});assert.throws(()=>commitRound(s,'screenshot',10000,{}),/already/);assert.equal(s.games.screenshot.done,false);continueCategory(s,'screenshot');assert.equal(s.games.screenshot.index,1);assert.equal(totalScore(s),7500);});
test('Giving up every task completes the loop at zero points',()=>{const s=make();for(const c of CATEGORIES)for(let i=0;i<c.rounds;i++){commitRound(s,c.id,0,{});continueCategory(s,c.id);}assert.equal(canAdvance(s),true);assert.equal(totalScore(s),0);});
test('Score deductions and partial character answers',()=>{assert.equal(roundScore('screenshot',{correct:true,hints:3}),2500);assert.equal(roundScore('opening',{correct:true,hints:1}),2500);assert.equal(roundScore('ending',{correct:false}),0);assert.equal(roundScore('character',{characters:[{character:true,anime:false},{character:false,anime:true}]}),2500);for(const [attempt,score]of [[1,10000],[3,10000],[4,9500],[13,5000],[18,2500],[22,500]])assert.equal(roundScore('anidle',{correct:true,attempt}),score);});
test('Anidle skip penalties survive serialization',()=>{const s=make();assert.equal(skipAnidle(s),false);s.games.anidle.attempt=4;skipAnidle(s);assert.equal(s.games.anidle.attempt,13);const loaded=JSON.parse(JSON.stringify(s));assert.equal(roundScore('anidle',{correct:true,attempt:loaded.games.anidle.attempt}),5000);skipAnidle(loaded);assert.equal(loaded.games.anidle.attempt,18);skipAnidle(loaded);assert.equal(loaded.games.anidle.attempt,22);assert.equal(skipAnidle(loaded),false);});
test('Daily selection is deterministic; character tasks have distinct figures',()=>{const a=createSession('daily','day','same-day',ids),b=createSession('daily','day','same-day',ids);assert.deepEqual(a.games,b.games);for(const q of a.games.character.questions)assert.equal(new Set(q).size,4);assert.equal(dayKey(new Date(2026,0,2)),'2026-01-02');});
test('Aliases and comparison arrows',()=>{assert.equal(matches('Haikyuu!!',['Haikyuu']),true);assert.equal(matches('ナルト',['ナルト']),true);assert.equal(matches('',['']),false);const r=compareAnime(pack.anime[0],pack.anime[2]);assert.equal(r.year,1);assert.equal(r.score,1);assert.equal(r.source,true);assert.equal(r.studio,false);});
test('Media validation rejects unsafe URLs and duplicate IDs',()=>{assert.equal(validatePack(pack),pack);for(const url of ['javascript:alert(1)','data:text/html;base64,AAAA','http://example.com/x']){const p=structuredClone(pack);p.anime[0].characterImage=url;assert.throws(()=>validatePack(p),/image source/);}const duplicate=structuredClone(pack);duplicate.anime[1].id=duplicate.anime[0].id;assert.throws(()=>validatePack(duplicate),/unique/);});
test('Invalid IDs and score ranges are rejected',()=>{assert.throws(()=>createSession('infinity',1,'seed',['a','a','b','c']),/unique/);assert.throws(()=>commitRound(make(),'opening',10000,{}),/Invalid/);assert.throws(()=>commitRound(make(),'screenshot',-1,{}),/Invalid/);});

const realPack=JSON.parse(readFileSync(new URL('../data/pool.json',import.meta.url)));
test('Real-media pool validates and contains no demo tracks',()=>{validatePack(realPack);for(const a of realPack.anime)for(const kind of ['opening','ending'])if(a[kind]){assert.equal(a[kind].demo,false);assert.match(a[kind].audio,/^(assets\/media|media)\/.+\.(mp3|ogg|webm)$/);assert.match(a[kind].video,/^(assets\/media|media)\/.+\.(mp4|webm)$/);}});
test('Every randomized loop contains Easy, Medium, Hard with valid real-media questions',()=>{for(let i=0;i<200;i++){const s=createSession('infinity',i,'random-'+i,realPack.anime,realPack.key);for(const c of CATEGORIES.filter(c=>c.id!=='anidle'))assert.deepEqual(s.games[c.id].levels,['Easy','Medium','Hard']);for(let r=0;r<3;r++){assert.equal(new Set(s.games.character.characterRefs[r]).size,4);const id=s.games.screenshot.questions[r],a=realPack.anime.find(a=>a.id===id);assert.ok(a.screenshots.length>=3);assert.equal(new Set(s.games.screenshot.frames[r]).size,3);}}});
test('Different seeds vary anime and frames; next loop avoids the previous titles',()=>{const a=createSession('infinity',1,'first-real',realPack.anime,realPack.key),b=createSession('infinity',1,'second-real',realPack.anime,realPack.key);assert.notDeepEqual(a.games.screenshot.questions,b.games.screenshot.questions);assert.notDeepEqual(a.games.screenshot.frames,b.games.screenshot.frames);for(const c of CATEGORIES)complete(a,c);const next=nextInfinity(a,realPack.anime,'new-real');for(const id of ['screenshot','opening','ending','anidle'])assert.ok(next.games[id].questions.every(q=>!a.games[id].questions.includes(q)));});
test('Random real-media selections and variants survive serialization',()=>{const s=createSession('daily','today','fixed-real',realPack.anime,realPack.key);const restored=JSON.parse(JSON.stringify(s));assert.deepEqual(s.games,restored.games);assert.deepEqual(createSession('daily','today','fixed-real',realPack.anime,realPack.key).games,s.games);});
test('Every referenced pool asset exists locally or has a registered remote source',()=>{let registry={};try{registry=JSON.parse(readFileSync(new URL('../data/media-index.json',import.meta.url)));}catch{}for(const a of realPack.anime){const paths=[...a.screenshots,a.cover,...(a.characters||[]).map(c=>c.image),a.opening?.audio,a.opening?.video,a.ending?.audio,a.ending?.video].filter(Boolean);for(const path of paths){if(path.startsWith('media/')){assert.ok(registry[path.slice(6)]?.url.startsWith('https://'),path);}else{const content=readFileSync(new URL('../'+path,import.meta.url));assert.ok(content.length>100,path);}}}});

test('Anidle summary reveals only properties supported by guesses and tightens numeric bounds',async()=>{
 const {summarizeAnidle}=await import('../core.js');
 const target={id:'t',year:2015,score:8.26,studio:'Known',source:'Manga',genres:['Action'],tags:['Hero'],secondary:['School']};
 const low={id:'l',year:2008,score:7.36,studio:'Other',source:'Novel',genres:['Action','Drama'],tags:['School','Secret']};
 const high={id:'h',year:2016,score:8.25,studio:'Known',source:'Manga',genres:['Drama'],tags:['Hero']};
 const empty=summarizeAnidle([],[],target);assert.equal(empty.year.lower,null);assert.deepEqual(empty.tags,[]);assert.deepEqual(empty.studios,[]);
 const summary=summarizeAnidle([{id:'l'},{id:'h'}],[low,high],target);
 assert.deepEqual(summary.year,{lower:2009,upper:2015,exact:null});assert.equal(summary.score.lower,8.26);
 assert.deepEqual(summary.genres,['Action']);assert.deepEqual(summary.studios,['Known']);assert.deepEqual(summary.sources,['Manga']);
 assert.deepEqual(summary.tags,[{value:'School',match:'secondary'},{value:'Hero',match:'primary'}]);
});
test('All music sources are full sequences with playback starting at zero',()=>{
 for(const a of realPack.anime)for(const kind of ['opening','ending'])if(a[kind]){assert.equal(a[kind].fullLength,true);if(a[kind].audioDuration!==undefined)assert.ok(a[kind].audioDuration>24);if(a[kind].videoDuration!==undefined)assert.ok(a[kind].videoDuration>24);assert.equal(a[kind].videoStartFraction,0);}
});
test('Every Anidle candidate has a real synopsis, popular-character name and cover',async()=>{
 const {eligible}=await import('../core.js');const candidates=realPack.anime.filter(a=>eligible(a,'anidle'));assert.ok(candidates.length>=70);for(const a of candidates){assert.ok(a.synopsis.length>20);assert.ok(a.popularCharacter);assert.ok(a.cover);}
});

test('Opening video bounds support locked relative and absolute second windows',async()=>{
 const {videoBounds}=await import('../core.js');
 assert.deepEqual(videoBounds(100),{start:35,end:65});
 assert.deepEqual(videoBounds(90,{startSeconds:20,endSeconds:50}),{start:20,end:50});
 assert.deepEqual(videoBounds(40,{startSeconds:20,endSeconds:100}),{start:20,end:40});
 assert.throws(()=>videoBounds(90,{startSeconds:50,endSeconds:20}),/video window/);
 assert.deepEqual(videoBounds(NaN),{start:0,end:0});
});
test('Invalid opening windows are rejected on import',()=>{const p=structuredClone(realPack);const a=p.anime.find(a=>a.opening);a.opening.videoWindow={startSeconds:80,endSeconds:20};assert.throws(()=>validatePack(p),/video window/);});

import {CATEGORIES,dayKey,totalScore,completedCount} from '../core.js';
export const STAT_SERIES=[...CATEGORIES.map((c,i)=>({id:c.id,name:c.name,color:['#90aacf','#83b7ae','#bac791','#c5a49c','#aaa5ce'][i]})),{id:'total',name:'Total',color:'#c4a0d0'}];
const validDay=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
const ordinal=value=>Math.round(Date.parse(value+'T12:00:00Z')/86400000);
const localDay=value=>{const date=new Date(value);return Number.isFinite(date.getTime())?dayKey(date):null;};
const keyOf=round=>round.key||`${round.mode}:${round.seed}`;
function storage(state){if(state.statistics?.version!==1)state.statistics={version:1,rounds:[],activityDays:[]};return state.statistics;}
export function snapshotRound(round,packName=''){
 if(!round?.games||!Object.values(round.games).some(g=>g.scores?.length))return null;
 const breakdown=Object.fromEntries(CATEGORIES.map(c=>[c.id,(round.games[c.id]?.scores||[]).reduce((sum,n)=>sum+n,0)]));
 const quizDay=round.mode==='daily'?String(round.seed||round.number).split(':')[0]:null;
 return {key:keyOf(round),mode:round.mode,number:round.number,date:round.lastPlayedAt||round.createdAt,day:validDay(quizDay)?quizDay:localDay(round.lastPlayedAt||round.createdAt),score:totalScore(round),complete:completedCount(round)===5,breakdown,packName,activityDays:round.activityDays||[]};
}
export function captureRound(state,round,packName=''){
 const record=snapshotRound(round,packName);if(!record)return;
 const stats=storage(state),index=stats.rounds.findIndex(r=>r.key===record.key);
 if(index>=0)stats.rounds[index]=record;else stats.rounds.push(record);
 stats.rounds=stats.rounds.slice(-1000);
}
export function recordActivity(state,round,now=new Date()){
 const day=dayKey(now),stats=storage(state);round.lastPlayedAt=now.toISOString();
 round.activityDays=[...new Set([...(round.activityDays||[]),day])];
 stats.activityDays=[...new Set([...stats.activityDays,day])].sort();
}
export function collectStatistics(state,today=dayKey()){
 const records=new Map();
 for(const item of [...state.history||[],...state.statistics?.rounds||[],snapshotRound(state.daily),snapshotRound(state.infinity)].filter(Boolean)){
  if(!['daily','infinity'].includes(item.mode)||!Number.isFinite(item.score))continue;
  const day=validDay(item.day)?item.day:item.mode==='daily'&&validDay(String(item.number))?String(item.number):localDay(item.date);
  if(!validDay(day))continue;
  const key=keyOf(item),previous=records.get(key);records.set(key,{...previous,...item,key,day,breakdown:item.breakdown||previous?.breakdown||null});
 }
 const rounds=[...records.values()].sort((a,b)=>a.day.localeCompare(b.day));
 const days=[...new Set([...(state.statistics?.activityDays||[]),...rounds.flatMap(r=>r.activityDays?.length?r.activityDays:[r.day])])].filter(d=>validDay(d)&&d<=today).sort();
 let bestStreak=0,length=0,previous=null;
 for(const day of days){length=previous!==null&&ordinal(day)-ordinal(previous)===1?length+1:1;bestStreak=Math.max(bestStreak,length);previous=day;}
 let currentStreak=0,cursor=ordinal(today);const played=new Set(days.map(ordinal));if(!played.has(cursor))cursor--;
 while(played.has(cursor)){currentStreak++;cursor--;}
 const complete=rounds.filter(r=>r.complete),daily=complete.filter(r=>r.mode==='daily');
 const highestDaily=daily.reduce((best,r)=>!best||r.score>best.score?r:best,null);
 return {rounds,days,activeDays:days.length,currentStreak,bestStreak,highestDaily,completed:complete.length,totalPoints:rounds.reduce((sum,r)=>sum+r.score,0),average:complete.length?Math.round(complete.reduce((sum,r)=>sum+r.score,0)/complete.length):null};
}
export function historySeries(rounds,{mode='daily',range='30',today=dayKey()}={}){
 const from=range==='all'?-Infinity:ordinal(today)-Number(range)+1,byDay=new Map();
 for(const round of rounds){if(!round.complete||round.mode!==mode||ordinal(round.day)<from||round.day>today)continue;const old=byDay.get(round.day);if(!old||round.score>old.score)byDay.set(round.day,round);}
 return [...byDay.values()].sort((a,b)=>a.day.localeCompare(b.day));
}
export function seriesAverage(rows,id){const values=rows.map(r=>id==='total'?r.score:r.breakdown?.[id]).filter(Number.isFinite);return values.length?values.reduce((sum,n)=>sum+n,0)/values.length:null;}
export function createStatistics(ctx){
 const {esc,fmt,button:btn}=ctx;let mode='daily',range='30',visible=new Set(STAT_SERIES.map(s=>s.id)),averages=new Set(),rows=[],selected=null;
 const pretty=day=>new Date(day+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});
 const value=(row,id)=>id==='total'?row.score:row.breakdown?.[id];
 function chart(){
  const W=1000,H=365,left=64,right=972,top=25,bottom=304;
  const first=ordinal(rows[0].day),last=ordinal(rows.at(-1).day),span=Math.max(1,last-first);
  const x=day=>rows.length===1?(left+right)/2:left+(ordinal(day)-first)/span*(right-left);
  const values=STAT_SERIES.flatMap(s=>[...(visible.has(s.id)?rows.map(r=>value(r,s.id)):[]),...(averages.has(s.id)?[seriesAverage(rows,s.id)]:[])]).filter(Number.isFinite);
  const ceiling=visible.has('total')||averages.has('total')?100000:Math.max(10000,Math.ceil(Math.max(0,...values)/10000)*10000);
  const y=n=>bottom-n/ceiling*(bottom-top);let drawing='';
  for(let i=0;i<=5;i++){const n=ceiling*i/5;drawing+=`<line x1="${left}" x2="${right}" y1="${y(n)}" y2="${y(n)}" class="stats-gridline"/><text x="${left-14}" y="${y(n)+5}" text-anchor="end" class="stats-axis">${n?fmt(n/1000)+'k':'0'}</text>`;}
  const labels=[...new Set(Array.from({length:Math.min(6,rows.length)},(_,i)=>Math.round(i*(rows.length-1)/Math.max(1,Math.min(6,rows.length)-1))))];
  for(const index of labels){const r=rows[index];drawing+=`<text x="${x(r.day)}" y="${bottom+33}" text-anchor="middle" class="stats-axis">${esc(new Date(r.day+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'}))}</text>`;}
  for(const s of STAT_SERIES){
   if(averages.has(s.id)){const avg=seriesAverage(rows,s.id);if(avg!==null)drawing+=`<line data-stats-average="${s.id}" x1="${left}" x2="${right}" y1="${y(avg)}" y2="${y(avg)}" stroke="${s.color}" stroke-width="1.5" stroke-dasharray="7 6" opacity=".65"/>`;}
   if(!visible.has(s.id))continue;
   const points=rows.filter(r=>Number.isFinite(value(r,s.id)));
   for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],gap=ordinal(b.day)-ordinal(a.day)>1;drawing+=`<path data-stats-line="${s.id}" d="M ${x(a.day)} ${y(value(a,s.id))} L ${x(b.day)} ${y(value(b,s.id))}" fill="none" stroke="${s.color}" stroke-width="${s.id==='total'?3:2}" ${gap?'stroke-dasharray="6 6" opacity=".6"':''}/>`;}
   for(const r of points)drawing+=`<circle cx="${x(r.day)}" cy="${y(value(r,s.id))}" r="${s.id==='total'?4:3}" fill="${s.color}"/>`;
  }
  drawing+=rows.map((r,i)=>`<rect data-stat-point="${i}" tabindex="0" role="button" aria-label="${esc(pretty(r.day))}: ${fmt(r.score)} total points. Show category scores." x="${Math.max(left-12,x(r.day)-18)}" y="${top}" width="36" height="${bottom-top}" fill="transparent"/>`).join('');
  return `<div class="stats-chart-scroll"><svg class="score-history-chart" viewBox="0 0 ${W} ${H}" role="group" aria-labelledby="score-chart-title score-chart-desc"><title id="score-chart-title">${mode==='daily'?'Daily':'Infinity'} score history</title><desc id="score-chart-desc">Best completed round per recorded day. Solid lines connect consecutive days; dashed lines span gaps. Missing category details are not plotted. Focus a date to inspect its scores; the data table provides all values.</desc>${drawing}</svg></div>`;
 }
 function readout(row){return row?`<div class="stats-selected-date"><strong>${esc(pretty(row.day))}</strong><span>${mode==='daily'?'Daily quiz':'Best Infinity round'}</span></div><div class="stats-selected-scores">${STAT_SERIES.map(s=>`<span style="--series-color:${s.color}"><i></i>${s.name} <strong>${Number.isFinite(value(row,s.id))?fmt(value(row,s.id)):'—'}</strong></span>`).join('')}</div>`:'';}
 function view(){
  const stats=collectStatistics(ctx.state());rows=historySeries(stats.rounds,{mode,range});const current=ctx.session(),progress=completedCount(current);
  selected=rows.find(r=>r.day===selected?.day)||rows.at(-1)||null;
  return `<section class="statistics-heading"><div><h1>Your anime record.</h1><p>Every round tells a story. See where you’re improving.</p></div><span class="stats-local-label">Saved on this device</span></section><div class="stats-metrics">${[{label:'Recorded active days',value:fmt(stats.activeDays),note:'Days with recorded solo play'},{label:'Current play streak',value:fmt(stats.currentStreak),note:stats.currentStreak?'Keep it going with a round today':'Play today to start a streak'},{label:'Best play streak',value:fmt(stats.bestStreak),note:'Consecutive recorded play days'},{label:'Highest daily score',value:stats.highestDaily?fmt(stats.highestDaily.score):'—',note:stats.highestDaily?pretty(stats.highestDaily.day):'Complete a daily to set your record'}].map(m=>`<article><span>${m.label}</span><strong>${m.value}</strong><small>${esc(m.note)}</small></article>`).join('')}</div><section class="stats-chart-panel" aria-label="Score history"><div class="stats-chart-toolbar"><div><h2>Score history</h2><p>${mode==='daily'?'Completed daily quizzes':'Best completed Infinity round per day'} · ${rows.length} ${rows.length===1?'recorded day':'recorded days'}</p></div><div class="stats-filters"><div class="segmented" role="group" aria-label="Statistics mode">${['daily','infinity'].map(m=>btn('stats-mode:'+m,m==='daily'?'Daily':'Infinity',mode===m?'selected':'','aria-pressed="'+(mode===m)+'"')).join('')}</div><label for="stats-range" class="sr-only">History range</label><select id="stats-range"><option value="7" ${range==='7'?'selected':''}>7 days</option><option value="30" ${range==='30'?'selected':''}>1 month</option><option value="90" ${range==='90'?'selected':''}>3 months</option><option value="all" ${range==='all'?'selected':''}>All recorded</option></select></div></div>${rows.length?`<div id="stats-readout" class="stats-readout" aria-live="polite">${readout(selected)}</div>${chart()}<div class="stats-chart-key"><span><i class="solid"></i>Consecutive days</span><span><i class="gap"></i>Gap in recorded results</span><span><i class="average"></i>Average for this range</span></div><fieldset class="stats-series-controls"><legend class="sr-only">Chart categories and averages</legend>${STAT_SERIES.map(s=>`<div class="stats-series-option" style="--series-color:${s.color}"><label><input type="checkbox" data-stats-series="${s.id}" ${visible.has(s.id)?'checked':''}>${s.name}</label><label class="stats-average-label"><input type="checkbox" data-stats-average="${s.id}" ${averages.has(s.id)?'checked':''}>Average <span>${seriesAverage(rows,s.id)===null?'—':fmt(Math.round(seriesAverage(rows,s.id)))}</span></label></div>`).join('')}</fieldset><details class="stats-data-table"><summary>View score data table</summary><div class="stats-table-scroll"><table><caption class="sr-only">${mode==='daily'?'Daily':'Infinity'} results in the selected range</caption><thead><tr><th scope="col">Date</th>${STAT_SERIES.map(s=>`<th scope="col">${s.name}</th>`).join('')}</tr></thead><tbody>${[...rows].reverse().map(r=>`<tr><th scope="row">${esc(pretty(r.day))}</th>${STAT_SERIES.map(s=>`<td>${Number.isFinite(value(r,s.id))?fmt(value(r,s.id)):'—'}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`:`<div class="stats-empty"><span>◈</span><h3>${stats.rounds.some(r=>r.mode===mode&&r.complete)?'No completed rounds in this range.':'Your first result is waiting.'}</h3><p>${stats.rounds.some(r=>r.mode===mode&&r.complete)?'Choose a longer range to see older results.':'Complete all five categories to add a score to your history.'}</p>${btn('stats-play:'+mode,mode==='daily'?'Play the daily quiz':'Play Infinity','btn secondary')}</div>`}<p class="stats-source-note">Solo results saved on this device. Play streaks are separate from reward-claim streaks. Older archives retain totals and their saved dates; category lines start where detailed scores are available.</p></section><div class="stats-footer-summary"><span><strong>${fmt(stats.completed)}</strong> completed rounds</span><span><strong>${stats.average===null?'—':fmt(stats.average)}</strong> average completed round</span><span><strong>${fmt(stats.totalPoints)}</strong> recorded points</span></div><section class="stats-current-round"><div><h2>Your current ${current.mode==='daily'?'daily quiz':'Infinity round'}</h2><p>${progress} of 5 categories complete</p></div><div class="stats-current-categories">${CATEGORIES.map(c=>`<div><span>${c.name}${current.games[c.id].done?' ✓':''}</span><strong>${fmt(current.games[c.id].scores.reduce((a,b)=>a+b,0))}<small> / ${fmt(c.max)}</small></strong></div>`).join('')}</div>${btn('home','Continue playing','btn secondary small')}</section><details class="stats-archive"><summary>Round archive <span>${stats.rounds.length} recorded rounds</span></summary>${stats.rounds.length?`<div class="stats-table-scroll"><table><thead><tr><th scope="col">Round</th><th scope="col">Date</th><th scope="col">Status</th><th scope="col">Score</th></tr></thead><tbody>${[...stats.rounds].reverse().map(r=>`<tr><th scope="row">${r.mode==='daily'?'Daily quiz':'Infinity '+esc(r.number??'')}<small>${esc(r.packName||'Saved pool')}</small></th><td>${esc(pretty(r.day))}</td><td>${r.complete?'Complete':'Partially played'}</td><td>${fmt(r.score)}</td></tr>`).join('')}</tbody></table></div>`:'<p>Your archive starts when you play your first round.</p>'}</details>`;
 }
 function afterRender(){ctx.app.querySelectorAll('[data-stat-point]').forEach(point=>{const show=()=>{selected=rows[Number(point.dataset.statPoint)];const readoutNode=ctx.app.querySelector('#stats-readout');if(readoutNode)readoutNode.innerHTML=readout(selected);};point.addEventListener('pointerenter',show);point.addEventListener('focus',show);point.addEventListener('click',show);point.addEventListener('keydown',event=>{if(['ArrowRight','ArrowLeft'].includes(event.key)){event.preventDefault();const all=[...ctx.app.querySelectorAll('[data-stat-point]')],index=all.indexOf(point);all[Math.max(0,Math.min(all.length-1,index+(event.key==='ArrowRight'?1:-1)))].focus();}});});}
 function action(name){if(name.startsWith('stats-mode:')){mode=name.split(':')[1];ctx.render();return true;}if(name.startsWith('stats-play:')){ctx.play(name.split(':')[1]);return true;}return false;}
 function change(target){if(target.id==='stats-range'){range=target.value;ctx.render();ctx.app.querySelector('#stats-range')?.focus({preventScroll:true});return true;}const id=target.dataset.statsSeries||target.dataset.statsAverage;if(id){const set=target.dataset.statsAverage?averages:visible;target.checked?set.add(id):set.delete(id);const selector=target.dataset.statsAverage?'data-stats-average':'data-stats-series';ctx.render();ctx.app.querySelector('input['+selector+'="'+id+'"]')?.focus({preventScroll:true});return true;}return false;}
 return {view,afterRender,action,change};
}

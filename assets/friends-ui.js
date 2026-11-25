import {CATEGORIES,dayKey} from '../core.js';
import {runtimeConfig} from './runtime-config.js';
// The hosted daily is account-bound, resets at midnight UTC and saves scores automatically.
const hosted=runtimeConfig.mode==='supabase';
const quizDay=()=>hosted?new Date().toISOString().slice(0,10):dayKey();
// Approved profile pictures arrive as data URLs from the server; anything else falls back to an initial.
const FRAME_ID=/^[a-z]{2,16}$/;
export function avatarMarkup(name,url,esc,frame='classic'){const safe=typeof url==='string'&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(url),ring=FRAME_ID.test(frame||'')&&frame!=='classic'?` frame-${frame}`:'';return `<span class="player-avatar${ring}" aria-hidden="true">${safe?`<img src="${url}" alt="" loading="lazy" decoding="async">`:esc(String(name||'?').slice(0,1).toUpperCase())}</span>`;}
export function createFriends(ctx){
 const {esc,button:btn,fmt}=ctx;
 let data=null,error='',loading=false,busy=false,day=quizDay(),owner=null,request=0;
 const score=value=>value===null||value===undefined?'—':fmt(value);
 function clear(){request++;data=null;error='';loading=false;busy=false;owner=null;}
 async function load(){
  if(!ctx.user()){clear();return;}
  const id=ctx.user().id,serial=++request;owner=id;loading=true;error='';if(ctx.getView()==='friends')ctx.render();
  try{const result=await ctx.api('/api/friends?day='+encodeURIComponent(day));if(serial===request&&ctx.user()?.id===id)data=result;}
  catch(cause){if(serial===request){data=null;error=cause.message;}}
  finally{if(serial===request){loading=false;if(ctx.getView()==='friends')ctx.render();}}
 }
 function requests(items,incoming){return items.length?items.map(p=>`<div class="friend-request"><span class="friend-request-name">${avatarMarkup(p.username,p.pictureUrl,esc,p.frame)}<strong>${esc(p.username)}</strong></span><div>${incoming?btn('friend:accept:'+p.userId,'Accept','btn secondary small',busy?'disabled':'')+btn('friend:decline:'+p.userId,'Decline','btn ghost small',busy?'disabled':''):btn('friend:cancel:'+p.userId,'Cancel request','btn ghost small',busy?'disabled':'')}</div></div>`).join(''):`<p class="subtle">${incoming?'No incoming requests.':'No pending sent requests.'}</p>`;}
 function player(p,index){return `<article class="friend-score-card ${p.isSelf?'is-you':''}" data-friend-id="${p.userId}"><div class="friend-score-heading"><span class="friend-rank">${p.dailyScore===null?'—':index+1}</span>${avatarMarkup(p.username,p.pictureUrl,esc,p.frame)}<div class="friend-name"><h3>${esc(p.username)}${p.isSelf?'<span class="you-label">You</span>':''}</h3><p>${p.dailyScore===null?'No daily result submitted':`Daily completed · ${esc(day)}`}</p></div><div class="friend-daily-score"><strong>${score(p.dailyScore)}</strong><span>${p.dailyScore===null?'Not submitted':'/ 100,000'}</span></div></div><div class="friend-infinity"><span>Best Infinity <strong>${score(p.bestInfinity)}</strong></span><span>${fmt(p.infinityRounds)} submitted ${p.infinityRounds===1?'round':'rounds'}</span></div><details class="friend-results"><summary>Recent results & category scores</summary>${p.breakdown?`<div class="friend-category-scores">${CATEGORIES.map(c=>`<div><span>${esc(c.name)}</span><strong>${fmt(p.breakdown[c.id]||0)}</strong></div>`).join('')}</div>`:'<p class="subtle">No category breakdown for this quiz date.</p>'}<h4>Seven daily quizzes ending ${esc(day)}</h4><div class="friend-history">${p.history.map(h=>`<div><time datetime="${esc(h.day)}">${esc(h.day.slice(5))}</time><strong>${score(h.score)}</strong><small>${h.score===null?'Not submitted':'points'}</small></div>`).join('')}</div>${!p.isSelf?btn('friend:remove:'+p.userId,'Remove friend','btn ghost small',busy?'disabled':''):''}</details></article>`;}
 function view(){
  const signedIn=!!ctx.user(),visible=owner===ctx.user()?.id?data:null;
  return `<section class="friends-intro"><h1>Your friends.<br>Your daily rivalry.</h1><p>Compare completed daily quizzes and your best Infinity rounds. ${hosted?'Daily results are saved automatically when you finish.':'Only scores you choose to submit appear here.'}</p></section>${!signedIn?`<section class="panel friends-signin"><h2>Bring your friends into the loop.</h2><p>Create an account, add friends by username, and compare your results on the same AniLoop server.</p>${btn('login','Sign in','btn')}${btn('register','Create account','btn ghost')}</section>`:`<div class="friends-layout"><aside class="friends-manage"><section class="panel"><h2>Add a friend</h2><p class="subtle">Enter their exact AniLoop username. They’ll need to accept your request.</p><form data-friends-form="request"><div class="field"><label for="friend-username">Username</label><input id="friend-username" name="username" minlength="3" maxlength="24" pattern="[A-Za-z0-9_\\-]+" autocomplete="off" required placeholder="Their username"></div><button class="btn secondary" type="submit" ${busy?'disabled':''}>Send request</button><p class="friend-form-error media-error" role="alert" hidden></p></form></section><section class="panel"><h2>Incoming requests <span class="request-count">${visible?.incoming.length||0}</span></h2>${requests(visible?.incoming||[],true)}</section><section class="panel"><h2>Sent requests</h2>${requests(visible?.outgoing||[],false)}</section></aside><section class="friends-standings" aria-label="Friends results"><div class="friends-toolbar"><div><h2>Daily standings</h2><p class="subtle">${visible?.friendCount||0} ${(visible?.friendCount||0)===1?'friend':'friends'} · You’re included</p></div>${btn('friend:refresh','Refresh','btn ghost small',loading||busy?'disabled':'')}</div><div class="friends-date"><label for="friends-day">Quiz date</label><input id="friends-day" type="date" value="${esc(day)}"><span>Dates follow the daily quiz, which resets at ${hosted?'midnight UTC':'local midnight'}.</span></div>${error?`<p class="media-error" role="alert">${esc(error)} ${btn('friend:refresh','Retry','btn ghost small')}</p>`:''}${loading?'<p class="friends-loading" role="status">Loading your friends’ results…</p>':visible?`<div class="friend-score-list">${visible.players.map(player).join('')}</div>${visible.friendCount===0?'<p class="friends-empty">Your first rivalry starts with a request. Add a friend by username to compare scores here.</p>':''}`:''}<div class="friends-share-note"><h3>Make your daily count.</h3><p>${hosted?'Finish all five categories of today’s daily quiz. Your result is saved automatically, and your friends can see it here.':'Finish all five categories in the default daily quiz, return to Overview, and select <strong>Submit to leaderboard</strong>. Your friends can then see the result here.'} Local saves and Party/Co-op scores are separate.</p>${btn('friend:play-daily','Play today’s daily','btn secondary small')}</div></section></div>`}`;
 }
 async function action(name){
  if(name==='friends'){if(owner!==ctx.user()?.id)clear();ctx.go('friends');if(ctx.user())await load();return true;}
  if(!name.startsWith('friend:'))return false;
  if(!ctx.user()){ctx.login();return true;}
  const [,operation,id]=name.split(':');
  if(operation==='play-daily'){ctx.playDaily();return true;}
  if(operation==='refresh'){if(!busy)await load();return true;}
  if(busy)return true;busy=true;
  try{await ctx.api('/api/friends/'+operation,{userId:/^[0-9a-f-]{36}$/i.test(id)?id:Number(id)});await load();ctx.toast({accept:'Friend request accepted.',decline:'Request declined.',cancel:'Request canceled.',remove:'Friend removed.'}[operation]||'Friend list updated.');}
  catch(cause){error=cause.message;if(ctx.getView()==='friends')ctx.render();}
  finally{busy=false;if(ctx.getView()==='friends')ctx.render();}return true;
 }
 async function submit(form){if(busy)return;busy=true;const input=form.querySelector('input'),button=form.querySelector('[type=submit]');button.disabled=true;
  try{await ctx.api('/api/friends/request',{username:input.value.trim()});await load();ctx.toast('Friend request sent.');}
  catch(cause){const note=form.querySelector('.friend-form-error');if(note?.isConnected){note.hidden=false;note.textContent=cause.message;}}
  finally{busy=false;if(button.isConnected)button.disabled=false;else if(ctx.getView()==='friends')ctx.render();}
 }
 async function selectDay(value){day=value||quizDay();await load();}
 return {view,action,submit,selectDay,clear,load};
}

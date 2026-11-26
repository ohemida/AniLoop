import {runtimeConfig} from './runtime-config.js';
import {createCloudRuntime} from './cloud-runtime.js';
import {privacyGate} from './privacy-choice.js';
const cloudMode=runtimeConfig.mode==='supabase';
await privacyGate();
const cloud=cloudMode?createCloudRuntime(runtimeConfig):null;
if(cloud)await cloud.start();
const status=document.querySelector('#status');
let search='',openPlayer=null,data=null;
function node(tag,text,cls){const n=document.createElement(tag);if(text!==undefined&&text!==null)n.textContent=text;if(cls)n.className=cls;return n;}
function btn(text,onClick,cls=''){const b=node('button',text,cls);b.type='button';b.addEventListener('click',()=>onClick(b));return b;}
async function request(path,payload){
 if(cloudMode)return cloud.api(path,payload);
 const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...(payload?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}:{})});
 const result=await response.json();
 if(!response.ok)throw new Error(response.status===401?'Sign in to your administrator account in AniLoop first.':response.status===403?'This account does not have administrator access.':result.error||'Unable to complete this action.');
 return result;
}
async function write(payload,button,message='Changes saved.'){
 if(button)button.disabled=true;
 try{const result=await request('/api/admin/action',payload);await load();status.textContent=typeof message==='function'?message(result):message;return result;}
 catch(error){status.textContent=error.message;}
 finally{if(button)button.disabled=false;}
}
const fmt=n=>n===null||n===undefined?'—':Number(n).toLocaleString('en-US');
const PICTURE={approved:'Approved',pending:'Waiting for review',private:'Not shared yet'};

function overview(){
 const box=document.querySelector('#overview');box.replaceChildren();
 const players=data.players,admins=players.filter(p=>p.role==='admin').length,pending=(data.pictures||[]).length;
 for(const [label,value] of [['Players shown',players.length],['Admins',admins],['Pictures waiting',pending],['Bug reports',data.reports.length]]){const card=node('div',null,'stat');card.append(node('strong',fmt(value)),node('span',label));box.append(card);}
 const filter=document.querySelector('#filter-state');
 filter.className='filter-state '+(data.moderation==='configured'?'ok':'warn');
 filter.textContent=data.moderation==='configured'?'✓ Automatic picture safety filter is configured (OpenAI moderation). New pictures are checked on upload.':'⚠ The automatic picture safety filter is NOT configured. Every new profile picture waits here until you approve it, so nobody else can see it yet. Add the OPENAI_API_KEY secret to the Supabase Edge Function to check pictures automatically.';
}

function playerCard(player){
 const card=node('article',null,'player'+(openPlayer===player.id?' open':'')),head=node('button',null,'player-head');head.type='button';
 head.setAttribute('aria-expanded',String(openPlayer===player.id));
 head.append(node('strong',player.username),node('span',player.role==='admin'?'Admin':'','badge'+(player.role==='admin'?' admin':'')),node('span',`◇ ${fmt(player.shards)}`,'muted'),node('span',`∞ ${fmt(player.bestInfinity)} · Daily ${fmt(player.bestDaily)}`,'muted'),node('span',player.pictureStatus?PICTURE[player.pictureStatus]||player.pictureStatus:'No picture','muted'));
 head.addEventListener('click',()=>{openPlayer=openPlayer===player.id?null:player.id;render();});card.append(head);
 if(openPlayer!==player.id)return card;
 const body=node('div',null,'player-body');
 // shards
 const shards=node('form',null,'row'),input=node('input'),save=node('button','Set balance'),add=node('input'),addBtn=node('button','Add / remove');
 input.type='number';input.min='0';input.max='1000000000';input.value=player.shards;input.setAttribute('aria-label','Shard balance');save.type='submit';
 add.type='number';add.placeholder='+500 or -200';add.setAttribute('aria-label','Shards to add');addBtn.type='button';
 shards.addEventListener('submit',e=>{e.preventDefault();write({action:'set-shards',userId:player.id,shards:Number(input.value)},save);});
 addBtn.addEventListener('click',()=>{const amount=Number(add.value);if(!Number.isSafeInteger(amount)||!amount){status.textContent='Enter a whole number like 500 or -200.';return;}write({action:'add-shards',userId:player.id,amount},addBtn,r=>`Balance is now ◇ ${fmt(r.shards)}.`);});
 shards.append(node('label','Loop Shards'),input,save,add,addBtn);body.append(shards);
 // cosmetics
 const items=node('div',null,'row'),select=node('select');select.setAttribute('aria-label','Cosmetic');
 for(const id of data.cosmetics||[]){const o=node('option',(player.owned.includes(id)?'✓ ':'')+id);o.value=id;select.append(o);}
 items.append(node('label','Cosmetics'),select,btn('Give item',b=>write({action:'grant-item',userId:player.id,item:select.value},b,`Gave ${select.value} to ${player.username}.`)),btn('Take away',b=>write({action:'revoke-item',userId:player.id,item:select.value},b,`Removed ${select.value} from ${player.username}.`),'ghost'));
 body.append(items,node('p',`Owns ${player.owned.length} item(s): ${player.owned.join(', ')||'none'} · Frame: ${player.frame}`,'muted small'));
 // account
 const rename=node('div',null,'row'),name=node('input');name.value=player.username;name.setAttribute('aria-label','New username');name.maxLength=24;
 rename.append(node('label','Username'),name,btn('Rename',b=>write({action:'rename',userId:player.id,username:name.value.trim()},b,'Username changed.')));body.append(rename);
 const tools=node('div',null,'row wrap');tools.append(node('label','Tools'));
 tools.append(btn(player.role==='admin'?'Remove admin':'Make admin',b=>{if(confirm(`${player.role==='admin'?'Remove':'Give'} administrator access ${player.role==='admin'?'from':'to'} ${player.username}?`))write({action:'set-admin',userId:player.id,admin:player.role!=='admin'},b);},player.isSelf&&player.role==='admin'?'ghost hidden':'ghost'));
 tools.append(btn('Reset today’s daily',b=>{if(confirm(`Let ${player.username} play today’s daily again? Today’s daily score is removed.`))write({action:'reset-daily',userId:player.id},b,'Today’s daily was reset.');},'ghost'));
 if(player.pictureStatus){if(player.pictureStatus!=='approved')tools.append(btn('Approve picture',b=>write({action:'picture-approve',userId:player.id},b,'Picture approved.'),'ghost'));tools.append(btn('Delete picture',b=>{if(confirm('Delete this profile picture?'))write({action:'remove-picture',userId:player.id},b,'Picture deleted.');},'ghost danger'));}
 for(const [mode,label] of [['infinity','Clear Infinity scores'],['daily','Clear daily scores'],['all','Clear all scores']])tools.append(btn(label,b=>{if(confirm(`${label} for ${player.username}? This removes them from the leaderboards and cannot be undone.`))write({action:'clear-scores',userId:player.id,mode},b,'Scores removed.');},'ghost danger'));
 body.append(tools,node('p',`Account id ${player.id}${player.created?' · joined '+player.created.slice(0,10):''}`,'muted small'));
 card.append(body);return card;
}

function pictures(){
 const box=document.querySelector('#pictures');box.replaceChildren();
 const list=(data.pictures||[]).filter(p=>/^data:image\/(png|jpeg|webp);base64,/.test(p.pictureUrl));
 const actions=document.querySelector('#picture-actions');actions.replaceChildren();
 if(list.length){
  actions.append(btn(`Approve all (${list.length})`,b=>{if(confirm('Approve every picture shown here? Only do this after looking at them.'))write({action:'picture-approve-all'},b,r=>`${r.approved} picture(s) approved.`);}));
  if(data.moderation==='configured')actions.append(btn('Run safety filter again',b=>write({action:'picture-recheck'},b,r=>`${r.approved} approved · ${r.rejected} removed · ${r.waiting} still waiting.`),'ghost'));
 }
 for(const picture of list){
  const article=node('article',null,'picture'),image=node('img');
  image.src=picture.pictureUrl;image.alt=`Profile picture of ${picture.username}`;image.width=96;image.height=96;
  article.append(image,node('h3',picture.username),btn('Approve',b=>write({action:'picture-approve',userId:picture.userId},b,'Picture approved.')),btn('Reject',b=>{if(confirm('Delete this profile picture?'))write({action:'picture-reject',userId:picture.userId},b,'Picture deleted.');},'ghost danger'));
  box.append(article);
 }
 if(!list.length)box.append(node('p','No pictures are waiting for review.','muted'));
}

function reports(){
 const box=document.querySelector('#reports');box.replaceChildren();
 for(const report of data.reports){
  const article=node('article',null,'report');article.append(node('h3',report.title),node('p',`${report.id} · ${report.category} · ${new Date(report.created*1000).toISOString().slice(0,10)}`,'muted small'));
  for(const [label,key] of [['Steps','steps'],['Expected','expected'],['Actual','actual']])article.append(node('h4',label),node('p',report[key]));
  article.append(btn('Delete report',b=>{if(confirm('Permanently delete this bug report?'))write({action:'delete-report',reportId:report.id},b);},'ghost danger'));box.append(article);
 }
 if(!data.reports.length)box.append(node('p','No bug reports.','muted'));
}

function render(){
 overview();
 const list=document.querySelector('#players');list.replaceChildren(...data.players.map(playerCard));
 if(!data.players.length)list.append(node('p','No players match this search.','muted'));
 pictures();reports();
}
async function load(){
 data=await request('/api/admin'+(search?'?'+new URLSearchParams({q:search}):''));data.players=data.players.map(p=>({owned:[],frame:'classic',bestInfinity:null,bestDaily:null,pictureStatus:null,...p}));
 status.textContent=`Signed in as administrator · ${data.players.length} player(s) shown`;
 render();document.querySelector('#content').hidden=false;
}
const NAMES={screenshot:'▧ Screenshots',character:'♙ Characters',opening:'♫ Openings',ending:'♪ Endings',anidle:'◈ Anidle'};
const thumb=src=>{if(!src||!/^https:\/\//.test(src))return null;const img=node('img');img.loading='lazy';img.alt='';img.src=/^https:\/\/(cms\.aniguessr\.com|medias\.aniguessr\.com|cdn\.myanimelist\.net|s4\.anilist\.co)\//.test(src)?`https://wsrv.nl/?url=${encodeURIComponent(src)}&w=160&output=webp`:src;img.addEventListener('error',()=>{if(img.src!==src)img.src=src;},{once:true});return img;};
async function showDaily(button){
 const box=document.querySelector('#daily-answers');
 if(!box.hidden){box.hidden=true;button.textContent='Show answers';return;}
 button.disabled=true;
 try{
  const result=await request('/api/admin/daily');box.replaceChildren(node('p',`Daily for ${result.day} (UTC)`,'muted small'));
  for(const category of result.categories){
   const group=node('div',null,'daily-category');group.append(node('h3',NAMES[category.id]||category.id));
   category.rounds.forEach((round,i)=>{
    const row=node('div',null,'daily-round');row.append(node('span',`Q${i+1}${round.level?' · '+round.level:''}`,'muted small'));
    if(round.characters){const list=node('div',null,'daily-characters');for(const c of round.characters){const item=node('div',null,'daily-character'),img=thumb(c.image);if(img)item.append(img);item.append(node('strong',c.name),node('small',c.anime));list.append(item);}row.append(list);}
    else{const img=thumb(round.image),text=node('div');text.append(node('strong',round.anime));const sub=[round.original!==round.anime?round.original:'',round.detail||(round.year?String(round.year):'')].filter(Boolean).join(' · ');if(sub)text.append(node('small',sub));if(img)row.append(img);row.append(text);}
    group.append(row);
   });
   box.append(group);
  }
  box.hidden=false;button.textContent='Hide answers';
 }catch(error){status.textContent=error.message;}
 finally{button.disabled=false;}
}
document.querySelector('#daily-toggle').addEventListener('click',e=>showDaily(e.currentTarget));
let timer;
document.querySelector('#player-search').addEventListener('input',e=>{search=e.target.value.trim();clearTimeout(timer);timer=setTimeout(()=>load().catch(error=>{status.textContent=error.message;}),300);});
try{await load();}catch(error){status.textContent=error.message;document.querySelector('#content').hidden=true;}

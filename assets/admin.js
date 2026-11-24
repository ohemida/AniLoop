import {runtimeConfig} from './runtime-config.js';
import {createCloudRuntime} from './cloud-runtime.js';
import {privacyGate} from './privacy-choice.js';
const cloudMode=runtimeConfig.mode==='supabase';
await privacyGate();
const cloud=cloudMode?createCloudRuntime(runtimeConfig):null;
if(cloud)await cloud.start();
const status=document.querySelector('#status');
function node(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
async function request(path,payload){
 if(cloudMode)return cloud.api(path,payload);
 const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...(payload?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}:{})});
 const data=await response.json();
 if(!response.ok)throw new Error(response.status===401?'Sign in to your administrator account in AniLoop first.':response.status===403?'This account does not have administrator access.':data.error||'Unable to complete this action.');
 return data;
}
async function write(payload,button){
 button.disabled=true;
 try{await request('/api/admin/action',payload);await load();status.textContent='Changes saved.';}
 catch(error){status.textContent=error.message;}
 finally{button.disabled=false;}
}
async function load(){
 const data=await request('/api/admin');
 status.textContent=`${data.accountCount} registered server profiles · Read / write administration`;
 document.querySelector('#players').replaceChildren();document.querySelector('#reports').replaceChildren();document.querySelector('#pictures')?.replaceChildren();
 for(const player of data.players){
  const tr=node('tr'),cell=node('td'),form=node('form'),input=node('input'),save=node('button','Save');
  form.className='shard-form';input.type='number';input.min='0';input.max='1000000000';input.step='1';input.required=true;input.value=player.shards;input.setAttribute('aria-label',`${player.username} shard balance`);save.type='submit';
  form.append(input,save);form.addEventListener('submit',event=>{event.preventDefault();if(form.reportValidity())write({action:'set-shards',userId:player.id,shards:Number(input.value)},save);});cell.append(form);
  tr.append(node('td',player.username),node('td',player.role==='admin'?'Read / write':'None'),cell);document.querySelector('#players').append(tr);
 }
 for(const report of data.reports){
  const article=node('article');article.append(node('h3',report.title),node('p',`${report.id} · ${report.category} · ${new Date(report.created*1000).toISOString().slice(0,10)}`));
  for(const [label,key] of [['Steps','steps'],['Expected','expected'],['Actual','actual']])article.append(node('h4',label),node('p',report[key]));
  const remove=node('button','Delete report');remove.type='button';remove.addEventListener('click',()=>{if(confirm('Permanently delete this bug report?'))write({action:'delete-report',reportId:report.id},remove);});article.append(remove);document.querySelector('#reports').append(article);
 }
 for(const picture of data.pictures||[]){
  if(!/^data:image\/(png|jpeg|webp);base64,/.test(picture.pictureUrl))continue;
  const article=node('article'),image=node('img'),approve=node('button','Approve'),reject=node('button','Reject and delete');
  image.src=picture.pictureUrl;image.alt=`Profile picture of ${picture.username}`;image.width=96;image.height=96;approve.type=reject.type='button';
  approve.addEventListener('click',()=>write({action:'picture-approve',userId:picture.userId},approve));
  reject.addEventListener('click',()=>{if(confirm('Delete this profile picture?'))write({action:'picture-reject',userId:picture.userId},reject);});
  article.append(image,node('h3',picture.username),approve,reject);document.querySelector('#pictures')?.append(article);
 }
 if(!(data.pictures||[]).length)document.querySelector('#pictures')?.append(node('p','No pictures are waiting for review.'));
 if(!data.reports.length)document.querySelector('#reports').append(node('p','No bug reports.'));
 document.querySelector('#content').hidden=false;
}
try{await load();}catch(error){status.textContent=error.message;document.querySelector('#content').hidden=true;}

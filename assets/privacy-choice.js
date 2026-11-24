import {createPolicies,POLICY_PAGES,POLICY_VERSION} from './policies.js';
export const PRIVACY_KEY='aniloop-privacy-v1';
// Change this only when age, acknowledgement or optional-purpose requirements change.
export const CHOICE_VERSION='notice-choice-v2-adult';
export const CHOICE_LIFETIME=180*24*60*60*1000;
export function validChoice(value,now=Date.now()){
 return !!value&&value.version===CHOICE_VERSION&&typeof value.policyVersion==='string'&&/^\d{4}-\d{2}-\d{2}\.\d+$/.test(value.policyVersion)&&value.acknowledged===true&&value.adultConfirmed===true&&['all','necessary','decline'].includes(value.choice)&&Array.isArray(value.optionalPurposes)&&value.optionalPurposes.length===0&&Number.isFinite(value.savedAt)&&value.savedAt<=now+300000&&value.savedAt>now-CHOICE_LIFETIME;
}
export function readPrivacyChoice(){try{const value=JSON.parse(localStorage.getItem(PRIVACY_KEY));return validChoice(value)?value:null;}catch{return null;}}
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(action,label,cls='',extra='')=>`<button type="button" class="${cls}" data-action="${action}" ${extra}>${label}</button>`;
const policies=createPolicies({button});
// This notice acknowledges information. It does not obtain blanket processing consent.
// There are currently NO optional purposes: "all" never authorises future trackers.
export function privacyGate({force=false}={}){
 if(!force&&readPrivacyChoice())return Promise.resolve();
 const root=document.createElement('section');root.className='privacy-entry';
 const old=readPrivacyChoice();let acknowledged=!!old,adultConfirmed=!!old,busy=false;
 const previousFocus=document.activeElement;
 const app=document.querySelector('#app'),wasInert=app.inert;app.inert=true;app.setAttribute('aria-hidden','true');
 document.body.append(root);
 let page=POLICY_PAGES.includes(location.hash.slice(1))?location.hash.slice(1):null;
 return new Promise(resolve=>{
  function render(){root.innerHTML=`<div class="privacy-entry-shell"><a class="brand" href="#" data-action="notice"><img src="assets/mark.svg" alt="">AniLoop</a><div class="privacy-entry-intro"><h1>Before your next loop</h1><p>AniLoop is for adults aged 18 or over. Read the content warning and privacy notice, then choose your cookie settings.</p></div><section class="panel privacy-entry-card" aria-label="Privacy acknowledgement and cookie choices"><p><strong>18+ · Mature anime content.</strong> Anime imagery and music videos may contain nudity, sexual themes, violence or disturbing scenes. The full media library has not been individually age-rated. An age declaration is not identity verification.</p><p>AniLoop uses storage for your game saves, requested settings, and sign-in. <strong>No analytics, advertising, or optional tracking is installed.</strong></p><p>All three choices keep optional tracking off. You must confirm that you are 18 or older to play. Decline applies to optional cookies; storage needed for the features you request remains available.</p><nav class="privacy-entry-links" aria-label="Read the policies">${POLICY_PAGES.map(id=>button(id,{privacy:'Privacy policy',cookies:'Cookies & storage',terms:'Terms of use',legal:'Legal & contact'}[id])).join('')}</nav><label class="privacy-acknowledgement"><input type="checkbox" id="adult-confirm" ${adultConfirmed?'checked':''}><span>I confirm that I am 18 years old or older.<small>If you are under 18, do not continue. We do not collect your date of birth or identity documents.</small></span></label><label class="privacy-acknowledgement"><input type="checkbox" id="privacy-acknowledge" ${acknowledged?'checked':''}><span>I acknowledge that I have read the privacy notice.<small>This is an acknowledgement, not consent to all data processing or a waiver of my rights.</small></span></label><div class="privacy-entry-actions">${[['all','Accept all'],['necessary','Only necessary'],['decline','Decline']].map(([id,label])=>button('choose:'+id,label,'privacy-choice-button',acknowledged&&adultConfirmed&&!busy?'':'disabled')).join('')}</div><p class="privacy-entry-storage" role="status">Your acknowledgement and choice are saved in this browser for up to 180 days. Existing saves and media are preserved.</p><p>Questions? <a href="mailto:dailyaniloop@gmail.com">dailyaniloop@gmail.com</a>. This site remains a pre-launch draft.</p></section>${page?`<section class="privacy-entry-policy">${policies.view(page)}</section>`:''}</div>`;
  }
  root.addEventListener('change',event=>{if(['privacy-acknowledge','adult-confirm'].includes(event.target.id)){if(event.target.id==='privacy-acknowledge')acknowledged=event.target.checked;else adultConfirmed=event.target.checked;for(const b of root.querySelectorAll('.privacy-choice-button'))b.disabled=!acknowledged||!adultConfirmed||busy;}});
  root.addEventListener('click',event=>{const target=event.target.closest('[data-action]');if(!target)return;event.preventDefault();const action=target.dataset.action;
   if(POLICY_PAGES.includes(action)||action==='notice'){page=action==='notice'?null:action;render();if(page){const section=root.querySelector('.privacy-entry-policy');section.scrollIntoView();section.querySelector('h1').setAttribute('tabindex','-1');section.querySelector('h1').focus({preventScroll:true});}return;}
   if(action==='theme-picker'||action==='account'||action==='privacy-settings'){root.querySelector('.privacy-entry-storage').textContent='Choose your privacy settings above to continue. You can manage your account and theme afterwards.';root.querySelector('#privacy-acknowledge').focus();return;}
   if(!action.startsWith('choose:')||!acknowledged||!adultConfirmed||busy)return;const choice=action.split(':')[1];if(!['all','necessary','decline'].includes(choice))return;busy=true;
   const record={version:CHOICE_VERSION,policyVersion:POLICY_VERSION,acknowledged:true,adultConfirmed:true,choice,optionalPurposes:[],savedAt:Date.now()};
   try{localStorage.setItem(PRIVACY_KEY,JSON.stringify(record));}catch{/* Continue for this visit even if persistence is blocked. */}
   root.remove();app.inert=wasInert;app.removeAttribute('aria-hidden');if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});resolve();
  });render();root.querySelector('h1').setAttribute('tabindex','-1');root.querySelector('h1').focus();
 });
}

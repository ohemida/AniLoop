const STATE_KEY='aniloop-state-v1';
let stateScope=null;
function stateKey(){return stateScope?`${STATE_KEY}:${stateScope}`:STATE_KEY;}
export function setStateScope(value){stateScope=value?String(value):null;}
export function readState(){try{return JSON.parse(localStorage.getItem(stateKey()))||{};}catch{return {};}}
export function writeState(state){localStorage.setItem(stateKey(),JSON.stringify(state));}
let dbPromise;
function db(){return dbPromise??=new Promise((resolve,reject)=>{const r=indexedDB.open('aniloop-media',1);r.onupgradeneeded=()=>r.result.createObjectStore('packs');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function loadPack(){const database=await db();return new Promise((resolve,reject)=>{const r=database.transaction('packs').objectStore('packs').get('custom');r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);});}
export async function savePack(pack){const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction('packs','readwrite');tx.objectStore('packs').put(pack,'custom');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
export function validatePack(pack){
 if(!pack||pack.version!==1||typeof pack.name!=='string'||!Array.isArray(pack.anime)||pack.anime.length<4||pack.anime.length>50000)throw new Error('The pack requires version 1, a name, and 4–50,000 anime.');
 const ids=new Set();
 const safeURL=url=>typeof url==='string'&&(/^(?:assets|media)\/[a-zA-Z0-9_./-]+$/.test(url)&&!url.includes('..')||/^https:\/\//i.test(url)||/^data:(image\/(png|jpeg|webp|gif)|audio\/(mpeg|mp3|wav|ogg|webm)|video\/(mp4|webm));base64,/i.test(url));
 for(const a of pack.anime){
  if(!a.id||!/^[a-z0-9_-]+$/i.test(a.id)||ids.has(a.id))throw new Error('Anime IDs must be unique and contain letters, numbers, - or _.');ids.add(a.id);
  if(typeof a.title!=='string'||!a.title.trim())throw new Error(`Missing title for ${a.id}.`);
  for(const key of ['character','studio','source','synopsis'])if(a[key]!==undefined&&typeof a[key]!=='string')throw new Error(`Invalid text field ${key} for ${a.id}.`);
  if(a.year!==null&&(!Number.isInteger(a.year)||a.year<1900||a.year>2200)||a.score!==null&&(!Number.isFinite(a.score)||a.score<0||a.score>10))throw new Error(`Invalid year or rating: ${a.id}`);
  for(const key of ['genres','tags','aliases','characterAliases','secondary'])if(a[key]!==undefined&&(!Array.isArray(a[key])||a[key].some(v=>typeof v!=='string')))throw new Error(`Invalid list ${key}: ${a.id}`);
  if(!Array.isArray(a.screenshots)||a.screenshots.some(url=>!safeURL(url))||a.characterImage&&!safeURL(a.characterImage)||a.cover&&!safeURL(a.cover))throw new Error(`Invalid image source: ${a.id}`);
  if(a.characters){if(!Array.isArray(a.characters))throw new Error('Invalid character list.');for(const c of a.characters)if(!c.id||typeof c.name!=='string'||!safeURL(c.image)||!['Easy','Medium','Hard'].includes(c.difficulty)||!Array.isArray(c.aliases))throw new Error(`Invalid character: ${a.id}`);}
  for(const key of ['opening','ending']){const m=a[key];if(!m)continue;if(key==='opening'&&m.videoWindow){const w=m.videoWindow;const seconds=Number.isFinite(w.startSeconds)&&Number.isFinite(w.endSeconds)&&w.startSeconds>=0&&w.endSeconds>w.startSeconds;const fractions=Number.isFinite(w.startFraction)&&Number.isFinite(w.endFraction)&&w.startFraction>=0&&w.endFraction<=1&&w.endFraction>w.startFraction;if(!seconds&&!fractions)throw new Error('Invalid video window: '+a.id);}if(!m.demo&&!safeURL(m.audio)&&!safeURL(m.video))throw new Error(`Missing ${key} source: ${a.id}`);if(m.demo&&(!Array.isArray(m.notes)||!m.notes.length||m.notes.length>64||m.notes.some(n=>!Number.isInteger(n)||n<24||n>100)))throw new Error(`Invalid practice melody: ${a.id}`);for(const prop of ['audio','video'])if(m[prop]&&!safeURL(m[prop]))throw new Error(`Invalid media URL: ${a.id}`);}
 }
 return pack;
}

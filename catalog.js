import {poolCounts,eligible} from './core.js';
const indexes=new WeakMap();
const lower=value=>String(value??'').toLocaleLowerCase('en');
export function catalogIndex(entries){
 if(indexes.has(entries))return indexes.get(entries);
 const byId=new Map(entries.map(a=>[a.id,a]));
 const makeRecords=characters=>{const seen=new Set();return entries.flatMap(a=>characters?(a.characters||[]).map(c=>({title:c.name,aliases:c.aliases||[],subtitle:''})):[{title:a.englishTitle||a.alternativeTitle||a.title,aliases:[a.title,...a.aliases||[]],subtitle:a.japaneseTitle||a.title}]).filter(r=>{if(seen.has(r.title))return false;seen.add(r.title);return true;}).map(r=>({...r,normalized:lower(r.title),terms:[r.title,...r.aliases].map(lower)}));};
 let counts;
 const records={anime:makeRecords(false),character:makeRecords(true)};
 const library=entries.map(a=>({anime:a,terms:[a.title,a.englishTitle,a.alternativeTitle,a.japaneseTitle,...a.aliases||[],...(a.characters||[]).map(c=>c.name)].filter(Boolean).map(lower)}));
 const index={byId,get counts(){return counts??=poolCounts(entries);},suggest(query,type='anime',limit=7){query=lower(query.trim());if(!query)return [];const prefix=[],other=[];for(const r of records[type]||records.anime){if(r.terms.some(t=>t.includes(query)))(r.normalized.startsWith(query)?prefix:other).push(r);}return [...prefix,...other].slice(0,limit);},search(query,category='all'){query=lower(query.trim());return library.filter(r=>(category==='all'||eligible(r.anime,category))&&(!query||r.terms.some(t=>t.includes(query)))).map(r=>r.anime);}};
 indexes.set(entries,index);return index;
}

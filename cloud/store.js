import {GameError,check} from './engine.js';
export class CloudRepository{
 constructor(url,secret,fetcher=fetch){this.url=url;this.secret=secret;this.serviceSecret=secret;this.fetcher=fetcher;}
 async request(path,payload,token=this.secret){
  const response=await this.fetcher(this.url+path,{method:payload===undefined?'GET':'POST',headers:{apikey:this.secret,Authorization:'Bearer '+token,'Content-Type':'application/json'},...(payload===undefined?{}:{body:JSON.stringify(payload)})});
  const data=await response.json().catch(()=>null);
  if(!response.ok){if(data?.code==='23505')throw new GameError('This record already exists.',409);throw new GameError(response.status>=500?'Cloud service temporarily unavailable.':data?.message?.includes('Administrator')?'Administrator access required.':'Cloud request failed. Check the installed AniLoop SQL.',response.status===403?403:503);}
  return data;
 }
 async profile(id){return (await this.request('/rest/v1/aniloop_profiles?'+new URLSearchParams({id:'eq.'+id,select:'id,username,created_at'})))[0]||null;}
 async findProfile(name){return (await this.request('/rest/v1/aniloop_profiles?'+new URLSearchParams({username:'eq.'+name,select:'id,username,created_at'})))[0]||null;}
 async isAdmin(id){return (await this.request('/rest/v1/aniloop_admins?'+new URLSearchParams({user_id:'eq.'+id,select:'user_id'}))).length>0;}
 async list(prefix,limit=100){return this.request('/rest/v1/aniloop_runtime?'+new URLSearchParams({key:'like.'+prefix+'%',select:'key,owner_id,value,revision',order:'updated_at.desc',limit:String(limit)}));}
 async getRuntime(key){return (await this.request('/rest/v1/aniloop_runtime?'+new URLSearchParams({key:'eq.'+key,select:'key,owner_id,value,revision'})))[0]||null;}
 // Public look (equipped frame + picture fields) of many players in one query.
 async looks(ids){const unique=[...new Set(ids)].filter(id=>/^[0-9a-f-]{36}$/i.test(id)).slice(0,250);if(!unique.length)return [];return this.request('/rest/v1/aniloop_runtime?'+new URLSearchParams({key:'in.('+unique.map(id=>`"account:${id}"`).join(',')+')',select:'owner_id,equipped:value->>equipped,pictureStatus:value->>pictureStatus,pictureType:value->>pictureType,picture:value->>picture'}));}
 async scoreRows(ids,mode,since){const unique=[...new Set(ids)].filter(id=>/^[0-9a-f-]{36}$/i.test(id));if(!unique.length)return [];const params=new URLSearchParams({user_id:'in.('+unique.join(',')+')',mode:'eq.'+mode,select:'user_id,score,created_at',order:'created_at.asc',limit:'20000'});if(since)params.set('created_at','gte.'+since);return this.request('/rest/v1/aniloop_scores?'+params);}
 async pendingPictures(limit=50){return this.request('/rest/v1/aniloop_runtime?'+new URLSearchParams({key:'like.account:%','value->>pictureStatus':'eq.pending',select:'owner_id,picture:value->>picture,pictureType:value->>pictureType',order:'updated_at.desc',limit:String(limit)}));}
 transaction(actor){return new CloudTransaction(this,actor);}
}
export class CloudTransaction{
 constructor(repository,actor){this.repository=repository;this.actor=actor;this.rows=new Map();this.writes=new Map();this.score=null;this.admin=false;}
 async get(key){
  if(this.writes.has(key))return this.writes.get(key).delete?null:this.writes.get(key).value;
  if(!this.rows.has(key)){const rows=await this.repository.request('/rest/v1/aniloop_runtime?'+new URLSearchParams({key:'eq.'+key,select:'key,owner_id,value,revision'}));this.rows.set(key,rows[0]||{key,revision:0,value:null});}
  return this.rows.get(key).value;
 }
 async put(key,value,owner=null){await this.get(key);this.writes.set(key,{key,value,owner});}
 async remove(key){await this.get(key);this.writes.set(key,{key,delete:true});}
 async commit(){if(!this.writes.size&&!this.score)return true;return this.repository.request('/rest/v1/rpc/aniloop_cloud_commit',{p_actor:this.actor,p_reads:[...this.rows.values()].map(({key,revision})=>({key,revision})),p_writes:[...this.writes.values()],p_score:this.score,p_admin:this.admin});}
}
export async function transaction(repository,actor,operation){
 for(let i=0;i<4;i++){const tx=repository.transaction(actor);const result=await operation(tx);if(await tx.commit())return result;}
 throw new GameError('Another player updated the game. Please try again.',409);
}

// Small Supabase Auth + Edge Function client for the static GitHub Pages build.
// This module does not read browser storage until start() is called after consent.
const STORAGE_KEY='aniloop-cloud-auth-v1';
const PKCE_KEY='aniloop-cloud-pkce-v1';
const policyVersion='2026-11-24.5';
export function createCloudRuntime(config){
 const base=String(config.supabaseUrl||'').replace(/\/$/,'');
 const key=String(config.publishableKey||'');
 const endpoint=String(config.functionUrl||`${base}/functions/v1/aniloop`);
 let auth=null,refreshing=null;
 const parse=async r=>{const data=await r.json().catch(()=>null);if(!r.ok)throw new Error(data?.error_description||data?.msg||data?.error||data?.message||'Supabase request failed.');return data;};
 const save=()=>{if(auth?.refresh_token)localStorage.setItem(STORAGE_KEY,JSON.stringify(auth));else localStorage.removeItem(STORAGE_KEY);};
 const authRequest=async(path,payload)=>parse(await fetch(base+'/auth/v1/'+path,{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify(payload)}));
 async function start(code=''){try{const value=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');if(value?.refresh_token)auth=value;}catch{auth=null;}if(code){const verifier=localStorage.getItem(PKCE_KEY);if(verifier){try{auth=await authRequest('token?grant_type=pkce',{auth_code:code,code_verifier:verifier});auth.expires_at=Date.now()/1000+(auth.expires_in||3600);save();}finally{localStorage.removeItem(PKCE_KEY);}}}if(auth?.expires_at&&auth.expires_at<Date.now()/1000+60)await refresh();}
 async function refresh(){if(refreshing)return refreshing;if(!auth?.refresh_token)return null;refreshing=(async()=>{try{auth=await authRequest('token?grant_type=refresh_token',{refresh_token:auth.refresh_token});auth.expires_at=Date.now()/1000+(auth.expires_in||3600);save();return auth;}catch{auth=null;save();return null;}finally{refreshing=null;}})();return refreshing;}
 async function invoke(path,payload,method){
  const send=()=>fetch(endpoint,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+(auth?.access_token||key),'Content-Type':'application/json'},body:JSON.stringify({path,method:method|| (payload===undefined?'GET':'POST'),payload})});
  let response=await send();if(response.status===401&&auth?.refresh_token){if(await refresh())response=await send();}
  const data=await response.json().catch(()=>null);if(!response.ok)throw new Error(data?.error||'AniLoop cloud request failed.');return data;
 }
 async function api(path,payload){
  const clean=path.split('?')[0],query=path.includes('?')?new URLSearchParams(path.split('?')[1]):new URLSearchParams();
  if(clean==='/api/login'){
   auth=await authRequest('token?grant_type=password',{email:payload.email,password:payload.password});auth.expires_at=Date.now()/1000+(auth.expires_in||3600);save();
   const result=await invoke('/api/account');return {...result,requiresConfirmation:false};
  }
  if(clean==='/api/register'){
   const verifier=base64url(crypto.getRandomValues(new Uint8Array(48))),digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)),challenge=base64url(new Uint8Array(digest));localStorage.setItem(PKCE_KEY,verifier);
   const result=await invoke(clean,{...payload,codeChallenge:challenge});if(result.session){auth=result.session;auth.expires_at=Date.now()/1000+(auth.expires_in||3600);save();localStorage.removeItem(PKCE_KEY);const account=await invoke('/api/account');return {...account,requiresConfirmation:false};}
   return {user:null,requiresConfirmation:true};
  }
  if(clean==='/api/logout'){try{if(auth?.access_token)await fetch(base+'/auth/v1/logout',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+auth.access_token}});}finally{auth=null;save();}return {ok:true};}
  if(clean==='/api/account/delete'){
   // Reauthenticate so the deletion RPC sees a recent password method in JWT AMR.
   const user=await invoke('/api/account');const profile=await authRequest('token?grant_type=password',{email:user.email,password:payload.password});
   auth=profile;auth.expires_at=Date.now()/1000+(auth.expires_in||3600);save();const result=await invoke(clean,{});auth=null;save();return result;
  }
  const merged=payload===undefined?Object.fromEntries(query):{...payload,...Object.fromEntries(query)};
  return invoke(path.includes('?')?`${clean}?${query}`:clean,payload===undefined?merged:merged,payload===undefined?'GET':'POST');
 }
 return {start,api,invoke,get accessToken(){return auth?.access_token||'';},get signedIn(){return !!auth?.access_token;},get policyVersion(){return policyVersion;}};
}
function base64url(bytes){let text='';for(const b of bytes)text+=String.fromCharCode(b);return btoa(text).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}

// Small Supabase Auth + Edge Function client for the static GitHub Pages build.
// This module does not read browser storage until start() is called after consent.
const STORAGE_KEY='aniloop-cloud-auth-v1';
const PKCE_KEY='aniloop-cloud-pkce-v1';
const RECOVERY_KEY='aniloop-cloud-recovery-v1';
const policyVersion='2026-11-24.5';
export function createCloudRuntime(config){
 const base=String(config.supabaseUrl||'').replace(/\/$/,'');
 const key=String(config.publishableKey||'');
 const endpoint=String(config.functionUrl||`${base}/functions/v1/aniloop`);
 let auth=null,refreshing=null;
 const parse=async r=>{const data=await r.json().catch(()=>null);if(!r.ok){const error=new Error(data?.error_description||data?.msg||data?.error||data?.message||'Supabase request failed.');error.status=r.status;throw error;}return data;};
 const save=()=>{if(auth?.refresh_token)localStorage.setItem(STORAGE_KEY,JSON.stringify(auth));else localStorage.removeItem(STORAGE_KEY);};
 const authRequest=async(path,payload)=>{let response;try{response=await fetch(base+'/auth/v1/'+path,{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify(payload)});}catch{throw new Error('Could not reach Supabase sign-in. Check your internet connection and try again.');}return parse(response);};
 async function start(code=''){let recovery=false;try{const value=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');if(value?.refresh_token)auth=value;}catch{auth=null;}if(code){const recoveryVerifier=localStorage.getItem(RECOVERY_KEY),verifier=recoveryVerifier||localStorage.getItem(PKCE_KEY);if(verifier){try{auth=await authRequest('token?grant_type=pkce',{auth_code:code,code_verifier:verifier});auth.expires_at=Date.now()/1000+(auth.expires_in||3600);save();recovery=!!recoveryVerifier;}finally{localStorage.removeItem(recoveryVerifier?RECOVERY_KEY:PKCE_KEY);}}else throw new Error('Open the reset link in the same browser where you requested it, or request a new link.');}if(auth?.expires_at&&auth.expires_at<Date.now()/1000+60)await refresh();return {recovery};}
 async function requestPasswordReset(email){const verifier=base64url(crypto.getRandomValues(new Uint8Array(48))),digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier));localStorage.setItem(RECOVERY_KEY,verifier);const redirect=location.origin+location.pathname;try{await authRequest('recover?'+new URLSearchParams({redirect_to:redirect}),{email,code_challenge:base64url(new Uint8Array(digest)),code_challenge_method:'s256'});}catch(error){localStorage.removeItem(RECOVERY_KEY);throw error;}}
 async function updatePassword(password){if(!auth?.access_token)throw new Error('Your reset session has expired. Request another reset link.');let response;try{response=await fetch(base+'/auth/v1/user',{method:'PUT',headers:{apikey:key,Authorization:'Bearer '+auth.access_token,'Content-Type':'application/json'},body:JSON.stringify({password})});}catch{throw new Error('Could not reach Supabase. Please try again.');}await parse(response);}
 async function refresh(){if(refreshing)return refreshing;if(!auth?.refresh_token)return null;refreshing=(async()=>{const before=auth;try{const next=await authRequest('token?grant_type=refresh_token',{refresh_token:before.refresh_token});next.expires_at=Date.now()/1000+(next.expires_in||3600);auth=next;save();return auth;}catch(error){if(error.status===400||error.status===401){const stored=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');if(stored?.refresh_token&&stored.refresh_token!==before.refresh_token){auth=stored;return auth;}auth=null;save();}return null;}finally{refreshing=null;}})();return refreshing;}
 function syncFromStorage(){try{const stored=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');if(stored?.refresh_token&&stored.refresh_token!==auth?.refresh_token&&(stored.expires_at||0)>(auth?.expires_at||0))auth=stored;}catch{}}
 async function invoke(path,payload,method){syncFromStorage();if(auth?.expires_at&&auth.expires_at<Date.now()/1000+30)await refresh();
  const send=()=>fetch(endpoint,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+(auth?.access_token||key),'Content-Type':'application/json'},body:JSON.stringify({path,method:method|| (payload===undefined?'GET':'POST'),payload})});
  let response;try{response=await send();if(response.status===401&&auth?.refresh_token){if(await refresh())response=await send();}}catch{throw new Error('AniLoop’s cloud service is unavailable. Please try again later.');}
  const data=await response.json().catch(()=>null);if(response.status===404&&data?.code==='NOT_FOUND')throw new Error('AniLoop’s cloud service has not been deployed yet. Please try again later.');if(!response.ok)throw new Error(data?.error||'AniLoop cloud request failed.');return data;
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
 return {start,api,invoke,requestPasswordReset,updatePassword,get accessToken(){return auth?.access_token||'';},get signedIn(){return !!auth?.access_token;},get policyVersion(){return policyVersion;}};
}
function base64url(bytes){let text='';for(const b of bytes)text+=String.fromCharCode(b);return btoa(text).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}

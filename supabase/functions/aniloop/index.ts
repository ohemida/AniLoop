import pool from '../../../data/pool.json' with { type: 'json' };
import { CloudRepository } from '../../../cloud/store.js';
import { CloudService } from '../../../cloud/service.js';
import { GameError } from '../../../cloud/engine.js';

const url=Deno.env.get('SUPABASE_URL')||'';
const publishableKeys=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}');
const secretKeys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');
const anon=Deno.env.get('SUPABASE_ANON_KEY')||Deno.env.get('SUPABASE_PUBLISHABLE_KEY')||publishableKeys.default||'';
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||secretKeys.default||'';
const allowed=new Set((Deno.env.get('ANILOOP_ALLOWED_ORIGINS')||'https://ohemida.github.io,http://localhost:8098').split(',').map(x=>x.trim()).filter(Boolean));
const repository=new CloudRepository(url,serviceKey);
const openaiKey=Deno.env.get('OPENAI_API_KEY')||'';
// Profile picture safety filter: OpenAI's free omni-moderation model checks the
// image for sexual content/nudity, graphic violence and self-harm. Without a key
// (or if the check fails) pictures stay private until an admin approves them.
async function moderateImage(dataUrl:string){
 if(!openaiKey)return {status:'pending',reason:'not-configured'};
 const response=await fetch('https://api.openai.com/v1/moderations',{method:'POST',headers:{Authorization:'Bearer '+openaiKey,'Content-Type':'application/json'},body:JSON.stringify({model:'omni-moderation-latest',input:[{type:'image_url',image_url:{url:dataUrl}}]}),signal:AbortSignal.timeout(15000)});
 if(!response.ok)return {status:'pending',reason:'openai-'+response.status};
 const result=(await response.json().catch(()=>null))?.results?.[0];if(!result)return {status:'pending',reason:'openai-invalid'};
 const score=(name:string)=>Number(result.category_scores?.[name]||0);
 const blocked=result.flagged===true||score('sexual')>0.2||score('sexual/minors')>0.05||score('violence/graphic')>0.3||score('violence')>0.6||score('self-harm')>0.3||score('self-harm/intent')>0.3||score('self-harm/instructions')>0.3;
 return {status:blocked?'rejected':'approved',reason:null};
}
// The daily quiz seed is derived from this secret, so the daily cannot be
// computed in the browser. Set ANILOOP_DAILY_SECRET to rotate it independently.
const service=new CloudService(repository,pool,{dailySecret:Deno.env.get('ANILOOP_DAILY_SECRET')||serviceKey,moderateImage,moderationConfigured:!!openaiKey});
const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}});
function cors(origin){return {'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};}
async function register(payload){
 if(payload?.adultConfirmed!==true||payload?.privacyAcknowledged!==true||payload?.noticeVersion!=='2026-11-24.5')throw new GameError('Confirm that you are 18 or older and acknowledge the current privacy notice.',400);
 const username=String(payload.username||'').trim();if(!/^[A-Za-z0-9_-]{3,24}$/.test(username))throw new GameError('Username must contain 3–24 letters, digits, underscores or hyphens.');
 const email=String(payload.email||'').trim(),password=String(payload.password||'');if(email.length>254||!/^\S+@\S+\.\S+$/.test(email))throw new GameError('Enter a valid email address.');if(password.length<12||password.length>128)throw new GameError('Use a password from 12 to 128 characters.');
 const challenge=String(payload.codeChallenge||'');if(!/^[A-Za-z0-9_-]{43}$/.test(challenge))throw new GameError('Could not create a secure email confirmation link. Try again.');
 const qs=new URLSearchParams({redirect_to:'https://ohemida.github.io/AniLoop/',code_challenge:challenge,code_challenge_method:'s256'});
 const response=await fetch(url+'/auth/v1/signup?'+qs,{method:'POST',headers:{apikey:anon,Authorization:'Bearer '+anon,'Content-Type':'application/json'},body:JSON.stringify({email,password,data:{username,adultConfirmed:true,noticeVersion:'2026-11-24.5',privacyAcknowledged:payload.privacyAcknowledged===true}})});
 const data=await response.json().catch(()=>null);if(!response.ok)throw new GameError(data?.msg||data?.message||data?.error_description||'Supabase could not create this account.',response.status===429?429:400);return {session:data.session||null,requiresConfirmation:!data.session};
}
// Guests send the publishable key; only real user JWTs are verified. A temporary Auth
// outage must not look like a sign-out, so it returns 503 instead of an anonymous user.
async function identity(request){const token=request.headers.get('Authorization')?.replace(/^Bearer\s+/i,'')||'';if(!token||token===anon||token.split('.').length!==3)return {token:'',user:null};
 let response;try{response=await fetch(url+'/auth/v1/user',{headers:{apikey:anon,Authorization:'Bearer '+token},signal:AbortSignal.timeout(8000)});}catch{throw new GameError('Sign-in check is temporarily unavailable. Please try again.',503);}
 if(response.status===401||response.status===403)throw new GameError('Your session expired. Sign in again.',401);if(!response.ok)throw new GameError('Sign-in check is temporarily unavailable. Please try again.',503);const user=await response.json();return {token,user};
}
async function bugDigest(request){const raw=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||request.headers.get('cf-connecting-ip')||'unknown';const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(serviceKey),{name:'HMAC',hash:'SHA-256'},false,['sign']);const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(raw)));return [...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');}
Deno.serve(async request=>{
 const origin=request.headers.get('Origin')||'';if(!allowed.has(origin))return json({error:'This website origin is not allowed.'},403);
 const headers=cors(origin);if(request.method==='OPTIONS')return new Response(null,{status:204,headers});if(request.method!=='POST')return json({error:'Use the AniLoop JSON API.'},405,headers);
 if(!url||!anon||!serviceKey)return json({error:'Supabase Edge Function secrets are not configured.'},503,headers);
 if(Number(request.headers.get('Content-Length')||0)>1_100_000)return json({error:'Request is too large.'},413,headers);
 try{
  const raw=await request.text();if(new TextEncoder().encode(raw).length>1_100_000)throw new GameError('Request is too large.',413);
  const body=JSON.parse(raw);if(!body||typeof body!=='object'||Array.isArray(body))throw new GameError('Expected a JSON request.');
  const path=String(body.path||'');if(!path.startsWith('/api/'))throw new GameError('Unknown endpoint.',404);
  const route=path.split('?')[0],method=body.method||'POST';
  const reads=new Set(['/api/config','/api/account','/api/account/export','/api/leaderboard','/api/rooms/current','/api/rooms/view','/api/rewards','/api/friends','/api/admin','/api/daily']);
  if(route==='/api/account/save'||route==='/api/account/picture'? !['GET','POST'].includes(method):reads.has(route)?method!=='GET':method!=='POST')throw new GameError('Wrong method for this endpoint.',405);
  if(route==='/api/register')return json(await register(body.payload),200,headers);
  if(route==='/api/bugs'){
   const p=body.payload||{};if(!['General','Screenshots','Characters','Openings','Endings','Anidle','Multiplayer','Appearance'].includes(p.category))throw new GameError('Choose a report category.');
   const report={title:String(p.title||'').trim().slice(0,120),category:p.category,steps:String(p.steps||'').trim().slice(0,3000),expected:String(p.expected||'').trim().slice(0,2000),actual:String(p.actual||'').trim().slice(0,3000),diagnostics:p.diagnostics&&typeof p.diagnostics==='object'?p.diagnostics:{}};
   const result=await repository.request('/rest/v1/rpc/aniloop_cloud_submit_bug',{p_digest:await bugDigest(request),p_report:report});return json({id:result},200,headers);
  }
  const {token,user}=await identity(request),actor=user?.id||null;
  const protectedRoute=route!=='/api/config'&&route!=='/api/account'&&!route.startsWith('/api/leaderboard');if(protectedRoute&&!actor)throw new GameError('Sign in to continue.',401);
  if(actor){
   const profile=await repository.profile(actor);
   if(!profile&&user.user_metadata?.adultConfirmed===true&&user.user_metadata?.noticeVersion==='2026-11-24.5')await service.ensureProfile(actor,user.user_metadata);
  }
  const result=await service.handle(actor,user,method,path,body.payload||{},token);
  return json(result,200,headers);
 }catch(error){const status=Number.isInteger(error?.status)?error.status:503;const message=error instanceof GameError?error.message:(error?.message==='23505'?'This record already exists.':'AniLoop cloud service could not complete the request.');return json({error:message},status,headers);}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createCloudRuntime} from '../assets/cloud-runtime.js';

test('password recovery sends a PKCE challenge, exchanges the return and updates the password',async()=>{
 const values=new Map(),calls=[];
 globalThis.localStorage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
 globalThis.location={origin:'https://example.test',pathname:'/AniLoop/'};
 globalThis.fetch=async(url,options)=>{calls.push({url,options,body:JSON.parse(options.body)});return new Response(JSON.stringify(url.includes('grant_type=pkce')?{access_token:'recovery-token',refresh_token:'refresh',expires_in:3600}:{}),{status:200,headers:{'Content-Type':'application/json'}});};
 const cloud=createCloudRuntime({supabaseUrl:'https://auth.example',publishableKey:'public'});
 await cloud.requestPasswordReset('player@example.test');
 assert.equal(calls[0].body.email,'player@example.test');
 assert.equal(calls[0].body.code_challenge_method,'s256');
 assert.equal(calls[0].body.code_challenge.length,43);
 assert.equal(new URL(calls[0].url).searchParams.get('redirect_to'),'https://example.test/AniLoop/');
 assert.equal((await cloud.start('one-time-code')).recovery,true);
 assert.equal(calls[1].body.auth_code,'one-time-code');
 assert.ok(calls[1].body.code_verifier);
 assert.equal(values.has('aniloop-cloud-recovery-v1'),false);
 await cloud.updatePassword('a-strong-new-password');
 assert.equal(calls[2].options.method,'PUT');
 assert.equal(calls[2].options.headers.Authorization,'Bearer recovery-token');
 assert.equal(calls[2].body.password,'a-strong-new-password');
});

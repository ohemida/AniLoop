import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync,statSync,existsSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('Pages build is static, runnable without Python and excludes private media',()=>{
 const temp=mkdtempSync(path.join(os.tmpdir(),'aniloop-pages-'));
 const output=path.join(temp,'site');
 try{
  execFileSync(process.execPath,[path.join(root,'scripts/build_pages.mjs'),output],{cwd:root,stdio:'pipe'});
  const status=JSON.parse(readFileSync(path.join(output,'BUILD_STATUS.json'),'utf8'));
  assert.equal(status.pythonRuntimeRequired,false);
  assert.equal(status.requiresSupabaseFunctionDeployment,true);
  assert.ok(existsSync(path.join(output,'.nojekyll')));
  assert.ok(existsSync(path.join(output,'index.html')));
  assert.ok(existsSync(path.join(output,'assets/cloud-runtime.js')));
  assert.ok(!existsSync(path.join(output,'assets/media')));
  assert.ok(!existsSync(path.join(output,'.runtime')));
  assert.ok(!existsSync(path.join(output,'.tools')));
  const bundle=readFileSync(path.join(output,'assets/runtime-config.js'),'utf8');
  assert.match(bundle,/sb_publishable_/);
  assert.doesNotMatch(bundle,/sb_secret_|service_role/);
  assert.ok(statSync(path.join(output,'data/pool.json')).size>1_000_000);
 }finally{rmSync(temp,{recursive:true,force:true});}
});

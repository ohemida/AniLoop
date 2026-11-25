import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {splitPool} from '../scripts/split_pool.mjs';
import {CATEGORIES,eligible} from '../core.js';

const read=name=>JSON.parse(readFileSync(new URL('../data/'+name,import.meta.url)));

test('the browser pool is regenerated from data/pool.json (run node scripts/split_pool.mjs)',()=>{
 const {lite,synopses}=splitPool(read('pool.json'));
 assert.equal(JSON.stringify(read('pool-lite.json')),JSON.stringify(lite));
 assert.deepEqual(read('synopsis.json'),synopses);
});

test('the lite pool keeps every category eligibility identical to the full pool',()=>{
 const full=read('pool.json'),lite=read('pool-lite.json');
 for(const {id} of CATEGORIES)assert.deepEqual(lite.anime.filter(a=>eligible(a,id)).map(a=>a.id),full.anime.filter(a=>eligible(a,id)).map(a=>a.id),id);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {THEMES,BACKGROUNDS,FRAMES,DEFAULT_APPEARANCE,normalizeAppearance,readAppearance} from '../assets/appearance.js';
test('appearance defaults and malformed settings stay safe',()=>{
 for(const value of [null,{},'bad',{theme:'url(x)',background:'https://x',dim:NaN,inGame:'true',position:'left'}])assert.deepEqual(normalizeAppearance(value),DEFAULT_APPEARANCE);
 assert.deepEqual(normalizeAppearance({theme:'forest',background:'custom',dim:10,inGame:true,position:'top'}),{theme:'forest',background:'custom',dim:35,inGame:true,position:'top'});
 assert.equal(normalizeAppearance({dim:100}).dim,90);
});
test('palettes, original presets and frames have unique stable IDs',()=>{
 for(const items of [THEMES,BACKGROUNDS,FRAMES])assert.equal(new Set(items.map(x=>x.id)).size,items.length);
 assert.deepEqual(FRAMES.slice(0,4).map(f=>[f.id,f.price]),[['classic',0],['silver',250],['orbit',500],['starlit',1000]]);
 assert.equal(THEMES.length,9);assert.equal(FRAMES.length,13);
});
test('blocked or corrupted browser storage returns defaults',()=>{
 globalThis.localStorage={getItem(){throw Error('blocked');}};assert.deepEqual(readAppearance(),DEFAULT_APPEARANCE);
 globalThis.localStorage={getItem(){return '{broken';}};assert.deepEqual(readAppearance(),DEFAULT_APPEARANCE);
 globalThis.localStorage={getItem(){return '{"theme":"ink","background":"grid"}';}};assert.equal(readAppearance().theme,'ink');
 delete globalThis.localStorage;
});

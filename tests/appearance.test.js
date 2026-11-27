import test from 'node:test';
import assert from 'node:assert/strict';
import {THEMES,BACKGROUNDS,FRAMES,DEFAULT_APPEARANCE,normalizeAppearance,readAppearance,profileCrop,moveProfileCrop} from '../assets/appearance.js';
test('appearance defaults and malformed settings stay safe',()=>{
 for(const value of [null,{},'bad',{theme:'url(x)',background:'https://x',dim:NaN,inGame:'true',position:'left'}])assert.deepEqual(normalizeAppearance(value),DEFAULT_APPEARANCE);
 assert.deepEqual(normalizeAppearance({theme:'forest',background:'custom',dim:10,inGame:true,position:'top'}),{theme:'forest',background:'custom',dim:35,inGame:true,position:'top',profileX:50,profileY:50,profileZoom:1,bgZoom:1,bgX:50,bgY:0});
 assert.deepEqual([normalizeAppearance({bgZoom:9,bgX:-5,bgY:40}).bgZoom,normalizeAppearance({bgZoom:9,bgX:-5}).bgX,normalizeAppearance({position:'bottom'}).bgY],[3,0,100]);
 assert.equal(normalizeAppearance({dim:100}).dim,90);
});
test('palettes, original presets and frames have unique stable IDs',()=>{
 for(const items of [THEMES,BACKGROUNDS,FRAMES])assert.equal(new Set(items.map(x=>x.id)).size,items.length);
 assert.deepEqual(FRAMES.slice(0,4).map(f=>[f.id,f.price]),[['classic',0],['silver',250],['orbit',650],['starlit',1600]]);
 assert.equal(THEMES.length,9);assert.equal(FRAMES.length,13);
});
test('blocked or corrupted browser storage returns defaults',()=>{
 globalThis.localStorage={getItem(){throw Error('blocked');}};assert.deepEqual(readAppearance(),DEFAULT_APPEARANCE);
 globalThis.localStorage={getItem(){return '{broken';}};assert.deepEqual(readAppearance(),DEFAULT_APPEARANCE);
 globalThis.localStorage={getItem(){return '{"theme":"ink","background":"grid"}';}};assert.equal(readAppearance().theme,'ink');
 delete globalThis.localStorage;
});
test('profile crop can select image edges and zoom while staying within the source',()=>{
 assert.deepEqual(profileCrop(800,400),{x:200,y:0,side:400});
 assert.deepEqual(profileCrop(800,400,{x:100,y:0,zoom:2}),{x:600,y:0,side:200});
 assert.deepEqual(profileCrop(400,800,{x:0,y:100,zoom:2}),{x:0,y:600,side:200});
 assert.deepEqual(profileCrop(800,400,{x:-3,y:200,zoom:99}),{x:0,y:400-400/3,side:400/3});
});
test('dragging the image moves the crop in the opposite direction and clamps to its edges',()=>{
 const crop={x:50,y:50,zoom:2};
 const moved=moveProfileCrop(800,400,crop,50,-50,200);
 assert.ok(moved.x<crop.x);assert.ok(moved.y>crop.y);
 assert.equal(moveProfileCrop(800,400,crop,10000,-10000,200).x,0);
 assert.equal(moveProfileCrop(800,400,crop,10000,-10000,200).y,100);
});

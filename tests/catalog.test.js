import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogIndex} from '../catalog.js';
const entries=[{id:'a',title:'Shingeki no Kyojin',alternativeTitle:'Attack on Titan',aliases:['AoT'],characters:[{name:'Eren',aliases:['Eren Yeager'],id:'eren',difficulty:'Easy'}],screenshots:[],difficulty:{}},{id:'b',title:'Titan Story',aliases:[],characters:[],screenshots:[],difficulty:{}}];
test('Catalog indexes are reused per pack and isolated between packs',()=>{assert.equal(catalogIndex(entries),catalogIndex(entries));assert.notEqual(catalogIndex(entries),catalogIndex([...entries]));assert.equal(catalogIndex(entries).byId.get('a'),entries[0]);});
test('Autocomplete accepts aliases, prioritizes prefixes, and hides character origin',()=>{const index=catalogIndex(entries);assert.equal(index.suggest('AoT')[0].title,'Attack on Titan');assert.equal(index.suggest('Titan')[0].title,'Titan Story');assert.equal(index.suggest('Eren','character')[0].subtitle,'');assert.equal(index.suggest('Eren','character')[0].title,'Eren');assert.deepEqual(index.suggest(''),[]);});
test('Library search finds English, Japanese, aliases and characters',()=>{const index=catalogIndex(entries);for(const text of ['Attack on Titan','Shingeki','AoT','Eren'])assert.equal(index.search(text)[0].id,'a');assert.equal(index.search('unknown').length,0);});

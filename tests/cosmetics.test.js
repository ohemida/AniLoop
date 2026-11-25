import test from 'node:test';
import assert from 'node:assert/strict';
import {COSMETICS} from '../cloud/engine.js';
import {COSMETIC_ITEMS,nameMarkup,bannerClass} from '../assets/cosmetics.js';
import {FRAMES} from '../assets/appearance.js';

test('client and server cosmetic catalogues match (ids, types, names and prices)',()=>{
 const server=COSMETICS.map(({id,type,name,price})=>({id,type,name,price}));
 const client=[...FRAMES.filter(f=>f.id!=='classic').map(({id,name,price})=>({id,type:'frame',name,price})),...COSMETIC_ITEMS.map(({id,type,name,price})=>({id,type,name,price}))];
 const sort=list=>[...list].sort((a,b)=>a.id.localeCompare(b.id));
 assert.deepEqual(sort(client),sort(server));
 assert.equal(new Set(server.map(c=>c.id)).size,server.length);
 for(const c of server)assert.match(c.id,/^[a-z][a-z0-9-]{1,39}$/,'ids must satisfy the database shape check');
});

test('names, titles and banners only render known items and escape usernames',()=>{
 const esc=v=>String(v).replace(/</g,'&lt;');
 assert.equal(nameMarkup('<b>',{nameStyle:'name-gold',title:'title-legend'},esc),'<span class="player-name name-gold">&lt;b></span><small class="player-title">Loop Legend</small>');
 assert.equal(nameMarkup('Kit',{nameStyle:'evil" onclick="x',title:'nope'},esc),'<span class="player-name">Kit</span>');
 assert.equal(bannerClass({banner:'banner-stars'}),' has-banner banner-stars');
 assert.equal(bannerClass({banner:'title-legend'}),'');
});

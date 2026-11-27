import test from 'node:test';
import assert from 'node:assert/strict';
import {CloudRepository} from '../cloud/store.js';
import {CloudService} from '../cloud/service.js';

test('database account look returns an approved image without exposing other account data',async()=>{
 const id='8f27a733-7b4a-43c0-9a58-42f8d513df20';
 const repo=new CloudRepository('https://example.test','secret',async url=>{
  const request=new URL(url);
  assert.equal(request.searchParams.get('select'),'owner_id,value');
  return new Response(JSON.stringify([{owner_id:id,value:{picture:'iVBORw0KGgoAAA',pictureType:'png',pictureStatus:'approved',equipped:'classic',shards:123,privateSecret:'private'}}]),{status:200});
 });
 const service=new CloudService(repo,{anime:[]});
 const result=(await service.looksFor([id])).get(id);
 assert.equal(result.pictureUrl,'data:image/png;base64,iVBORw0KGgoAAA');
 assert.equal(result.shards,undefined);
 assert.equal(result.privateSecret,undefined);
});

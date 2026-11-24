import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanAuthReturn} from '../assets/auth-return.js';
test('email return code discarded without changing room/game route',()=>{
 const result=cleanAuthReturn('https://quiz.example/?room=ABC123&code=private#game/opening?mode=daily');
 assert.equal(result.changed,true);assert.equal(result.url,'https://quiz.example/?room=ABC123#game/opening?mode=daily');
});
test('legacy implicit secrets discarded, ordinary hashes preserved',()=>{
 const result=cleanAuthReturn('https://quiz.example/#access_token=secret&refresh_token=private');
 assert.equal(result.url,'https://quiz.example/');
 assert.equal(cleanAuthReturn('https://quiz.example/#privacy').changed,false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {validChoice,CHOICE_VERSION,CHOICE_LIFETIME,readPrivacyChoice,PRIVACY_KEY} from '../assets/privacy-choice.js';
const now=Date.now(),base={version:CHOICE_VERSION,acknowledged:true,optionalPurposes:[],savedAt:now};
test('a dismissed notice is remembered and never enables optional purposes',()=>{assert.equal(validChoice(base,now),true);assert.equal(validChoice({...base,optionalPurposes:['analytics']},now),false);});
test('missing acknowledgement, old versions or expiry show the notice again',()=>{
 for(const change of [{acknowledged:false},{version:'notice-choice-v2-adult'},{savedAt:now-CHOICE_LIFETIME},{savedAt:now+600000},{savedAt:'today'}])assert.equal(validChoice({...base,...change},now),false);
 for(const value of [null,{},'invalid',[]])assert.equal(validChoice(value,now),false);
});
test('corrupt or unavailable storage never counts as dismissed',()=>{
 globalThis.localStorage={getItem:key=>{assert.equal(key,PRIVACY_KEY);return JSON.stringify(base);}};assert.equal(readPrivacyChoice().acknowledged,true);
 globalThis.localStorage={getItem:()=>'{broken'};assert.equal(readPrivacyChoice(),null);
 globalThis.localStorage={getItem:()=>{throw Error('blocked');}};assert.equal(readPrivacyChoice(),null);delete globalThis.localStorage;
});

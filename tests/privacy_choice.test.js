import test from 'node:test';
import assert from 'node:assert/strict';
import {validChoice,CHOICE_VERSION,CHOICE_LIFETIME,readPrivacyChoice,PRIVACY_KEY} from '../assets/privacy-choice.js';
import {POLICY_VERSION} from '../assets/policies.js';
const now=Date.now(),base={version:CHOICE_VERSION,policyVersion:POLICY_VERSION,acknowledged:true,adultConfirmed:true,choice:'necessary',optionalPurposes:[],savedAt:now};
test('all three current choices keep optional purposes disabled',()=>{for(const choice of ['all','necessary','decline'])assert.equal(validChoice({...base,choice},now),true);assert.equal(validChoice({...base,optionalPurposes:['analytics']},now),false);});
test('missing acknowledgement, invalid choices, expiry or changed choice requirements re-prompt',()=>{
 for(const change of [{adultConfirmed:false},{adultConfirmed:undefined},{acknowledged:false},{choice:'invalid'},{policyVersion:'old'},{version:'old'},{savedAt:now-CHOICE_LIFETIME},{savedAt:now+600000},{savedAt:'today'}])assert.equal(validChoice({...base,...change},now),false);
 for(const value of [null,{},'invalid',[]])assert.equal(validChoice(value,now),false);
});
test('corrupt or unavailable choice storage never implies acceptance',()=>{
 globalThis.localStorage={getItem:key=>{assert.equal(key,PRIVACY_KEY);return JSON.stringify(base);}};assert.equal(readPrivacyChoice().choice,'necessary');
 globalThis.localStorage={getItem:()=>'{broken'};assert.equal(readPrivacyChoice(),null);
 globalThis.localStorage={getItem:()=>{throw Error('blocked');}};assert.equal(readPrivacyChoice(),null);delete globalThis.localStorage;
});

test('routine notice edits retain acknowledged age and optional-purpose choices',()=>{for(const policyVersion of ['2026-11-24.1','2026-11-24.2','2026-11-24.3','2026-11-24.4'])assert.equal(validChoice({...base,policyVersion},now),true);assert.equal(validChoice({...base,version:'new-purposes'},now),false);});

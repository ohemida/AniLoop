import test from 'node:test';
import assert from 'node:assert/strict';
import {readRoute,routeHash} from '../assets/navigation.js';
test('top-level views, category and mode survive URL round trips',()=>{
 for(const view of ['home','library','stats','leaderboard','friends','rooms','room','rewards','appearance','account','bug-report','privacy','cookies','terms','legal','help'])for(const mode of ['daily','infinity'])assert.deepEqual(readRoute(routeHash({view,mode})),{view,selected:null,mode});
 for(const selected of ['screenshot','character','opening','ending','anidle'])assert.deepEqual(readRoute(routeHash({view:'game',selected,mode:'daily'})),{view:'game',selected,mode:'daily'});
});
test('old policy hashes work and unknown routes/categories cannot enter a broken view',()=>{
 assert.deepEqual(readRoute('#privacy','daily'),{view:'privacy',selected:null,mode:'daily'});
 for(const hash of ['#unknown','#game/unknown','#game','#javascript:alert(1)'])assert.equal(readRoute(hash).view,'home');
 assert.equal(readRoute('#game/opening?mode=invalid','daily').mode,'daily');
});

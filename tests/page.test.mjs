import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {HTML} from '../src/page.mjs';
import artifact from '../public/contract.json' with {type:'json'};
test('Browser UI contains both saga branches and export evidence controls',()=>{
 for(const id of ['runhappy','runfail','recover','export','deploy','connect','reconcile'])
   assert.match(HTML,new RegExp('id="'+id+'"'));
 assert.match(HTML,/COMPENSATION_CONFIRMED/);
 assert.match(HTML,/STEP_CONFIRMED/);
});
test('Inline browser script parses with Node JavaScript grammar',()=>{
 const scripts=[...HTML.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
 assert.ok(scripts.length>=1);
 for(const [,script] of scripts)if(script.trim())new Script(script,{filename:'inline-saga-ui.js'});
});
test('Committed contract is compiled, testnet-bound and provides all saga functions',()=>{
 assert.equal(artifact.chainId,688689);
 assert.match(artifact.bytecode,/^0x[0-9a-f]{4000,}$/i);
 const saga=artifact.sagaAbi.filter(x=>x.type==='function').map(x=>x.name);
 const token=artifact.tokenAbi.filter(x=>x.type==='function').map(x=>x.name);
 for(const f of ['tokenA','tokenB','swap','deposit','compensateSwap','undoDeposit','pending','deposited'])assert.ok(saga.includes(f),f);
 for(const f of ['approve','allowance','balanceOf','transferFrom'])assert.ok(token.includes(f),f);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {CHAIN,assertReceipt,classifyFailure,createRun,updateRun,retryScheduleMs} from '../src/saga-core.mjs';
const wallet='0x0000000000000000000000000000000000000001';
const contract='0x0000000000000000000000000000000000000002';
const hash='0x'+'a'.repeat(64);
const good={transactionHash:hash,status:1,blockNumber:123};
const newRun=()=>createRun({mode:'success',wallet,contract,amount:'1'});
test('correct Pharos Atlantic chain id',()=>assert.equal(CHAIN.chainId,688689));
test('reject missing receipt',()=>assert.throws(()=>assertReceipt(null,hash),/Missing receipt/));
test('reject tx hash mismatch',()=>assert.throws(()=>assertReceipt({...good,transactionHash:'0x'+'b'.repeat(64)},hash),/mismatch/));
test('reject reverted receipt',()=>assert.throws(()=>assertReceipt({...good,status:0},hash),/reverted/));
test('accept successful onchain receipt with block',()=>assert.equal(assertReceipt(good,hash),true));
test('cannot jump to swap without approve receipt',()=>assert.throws(()=>updateRun(newRun(),{type:'STEP_SUBMITTED',step:'SWAP',hash}),/prior step/));
test('happy path 3 receipt-gated dependent steps',()=>{
 let r=updateRun(newRun(),{type:'START'});
 for(const step of ['APPROVE','SWAP','DEPOSIT']){
  r=updateRun(r,{type:'STEP_SUBMITTED',step,hash});
  r=updateRun(r,{type:'STEP_CONFIRMED',step,receipt:good});
 }
 r=updateRun(r,{type:'SUCCEEDED'});
 assert.equal(r.state,'SUCCEEDED');
 assert.deepEqual(r.steps.map(x=>x.status),['CONFIRMED','CONFIRMED','CONFIRMED']);
 assert.equal(r.timeline.length,9);
});
test('cannot succeed if one receipt not verified',()=>{
 let r=updateRun(newRun(),{type:'STEP_SUBMITTED',step:'APPROVE',hash});
 r=updateRun(r,{type:'STEP_CONFIRMED',step:'APPROVE',receipt:good});
 assert.throws(()=>updateRun(r,{type:'SUCCEEDED'}),/before 3 receipts/);
});
test('failed deposit transitions to compensating then compensated',()=>{
 let r=updateRun(newRun(),{type:'STEP_SUBMITTED',step:'APPROVE',hash});
 r=updateRun(r,{type:'STEP_CONFIRMED',step:'APPROVE',receipt:good});
 r=updateRun(r,{type:'STEP_SUBMITTED',step:'SWAP',hash});
 r=updateRun(r,{type:'STEP_CONFIRMED',step:'SWAP',receipt:good});
 r=updateRun(r,{type:'STEP_FAILED',step:'DEPOSIT',detail:'receipt status 0'});
 assert.equal(r.state,'FAILED');
 r=updateRun(r,{type:'COMPENSATING'});
 assert.equal(r.state,'COMPENSATING');
 r=updateRun(r,{type:'COMPENSATED'});
 assert.equal(r.state,'COMPENSATED');
});
test('unknown receipt halts rather than re-broadcast',()=>{
 let r=updateRun(newRun(),{type:'UNKNOWN_CONFIRMATION'});
 assert.equal(r.state,'NEEDS_RECONCILIATION');
});
test('retry policy bounded',()=>assert.deepEqual(retryScheduleMs,[0,1500,3500,7000,12000]));
test('classify user rejection as non-retryable',()=>assert.equal(classifyFailure(new Error('User rejected transaction')), 'USER_REJECTED'));
test('unknown broadcast is not automatically retryable',()=>assert.equal(classifyFailure(new Error('network down'),true),'CONFIRMATION_UNKNOWN'));
test('nonpositive amounts not permitted',()=>assert.throws(()=>createRun({mode:'success',wallet,contract,amount:'0'}),/positive/));

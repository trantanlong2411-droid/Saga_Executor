import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {HTML} from '../src/page.mjs';
import artifact from '../public/contract.json' with {type:'json'};
test('Browser UI contains both saga branches and export evidence controls',()=>{
 for(const id of ['runhappy','runfail','runrevert','saferecover','resume','recover','export','deploy','connect','reconcile'])
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

test('Resume guard revalidates receipts and actual allowances',()=>{
  assert.match(HTML,/SAGA_RESUMED/);
  assert.match(HTML,/approveRc=await waitReceipt/);
  assert.match(HTML,/swapRc=await waitReceipt/);
  assert.match(HTML,/a\.allowance\(wallet,address\(\)\)/);
  assert.match(HTML,/WALLET_SIGNATURE_REJECTED/);
});

test('Receipt state is checked at pinned block and latest and failures halt without resubmitting',()=>{
 assert.match(HTML,/await chainState\(rc.blockNumber\)/);
 assert.match(HTML,/await chainState\('latest'\)/);
 assert.match(HTML,/AWAITING_ONCHAIN_STATE/);
 assert.match(HTML,/STEP_RECONCILED/);
 assert.match(HTML,/rc.from\?\.toLowerCase/);
 assert.match(HTML,/rc.to\?\.toLowerCase/);
});

test('Compensation must verify state at receipt block and latest before completing',()=>{
 assert.match(HTML,/verifyCompensationState/);
 assert.match(HTML,/COMPENSATION_STATE_CONFIRMED/);
 assert.match(HTML,/BigInt\(s.pendingWei\)===0n/);
 assert.match(HTML,/BigInt\(s.allowanceWei\)===0n/);
});

test('OKX-safe failure mode never sends a reverting transaction',()=>{
 assert.match(HTML,/mode==='guard-failure'/);
 assert.match(HTML,/recordDepositBusinessFailure\(amount\)/);
 assert.match(HTML,/DEPOSIT_GUARD_FAILED/);
 assert.match(HTML,/transactionHash:null,receiptBlock:null,receiptStatus:null/);
 assert.match(HTML,/await rollbackTestSwap\(amount/);
});
test('Paused real swap receipt can be recovered without duplicate approve or swap',()=>{
 assert.match(HTML,/canFinishPausedFailure/);
 assert.match(HTML,/await waitReceipt\(run.steps\[1\].transactionHash\)/);
 assert.match(HTML,/SAFE_RECOVERY_SELECTED/);
 assert.match(HTML,/run.mode==='forced-failure'/);
});

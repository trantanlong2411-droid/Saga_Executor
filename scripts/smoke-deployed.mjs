import assert from 'node:assert/strict';
const base=process.env.SAGA_BASE_URL||'https://saga-executor.trantanlong2411.workers.dev';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function grab(path) {
 const res=await fetch(base+path,{signal:AbortSignal.timeout(16000)});
 const body=await res.text();
 if(!res.ok)throw new Error(path+' '+res.status+': '+body.slice(0,300));
 return {res,body};
}
async function main(){
 let health,attempts=0;
 for(let i=0;i<20;i++){
  attempts++;
  try{
   health=JSON.parse((await grab('/api/health')).body);
   if(health.ok&&health.compiled&&health.chainId===688689)break;
  }catch{}
  await sleep(5000);
 }
 assert.equal(health?.compiled,true,'Compiled Worker was not deployed in time');
 assert.equal(health.readOnlyServer,true);
 const h=(await grab('/')).body;
 assert.match(h,/SAGA/);assert.match(h,/EXECUTOR/);assert.match(h,/Run success saga/);
 const artifact=JSON.parse((await grab('/api/artifact')).body);
 assert.equal(artifact.chainId,688689);
 assert.match(artifact.bytecode,/^0x[0-9a-f]{4000,}$/i);
 const names=artifact.sagaAbi.filter(x=>x.type==='function').map(x=>x.name);
 for(const n of ['swap','deposit','compensateSwap'])assert.ok(names.includes(n));
 console.log('WORKER SMOKE SUCCESS',JSON.stringify({url:base,chainId:health.chainId,
  compiler:artifact.compiler,bytecodeLength:artifact.bytecode.length,attempts,
  warning:'This is deployed app validation, not proof of user-signed on-chain transactions.'}));
 // Valid, very unlikely to exist transaction hash. This checks the read-only
 // Atlantic RPC connectivity without pretending that an actual saga was sent.
 const zeroHash='0x'+'0'.repeat(64);
 const receiptRes=await grab('/api/tx/'+zeroHash);
 const receipt=JSON.parse(receiptRes.body);
 assert.equal(receipt.chainId,688689);
 assert.equal(receipt.receipt,null);
 console.log('ATLANTIC RPC READ SUCCESS: chain 688689, no fabricated receipt for null hash');
}
main().catch(err=>{console.error('SMOKE FAILED',err.message);process.exitCode=1;});

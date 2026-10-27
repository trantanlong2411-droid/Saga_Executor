import assert from 'node:assert/strict';
import {Interface} from 'ethers';
import artifact from '../public/contract.json' with {type:'json'};
import proof from '../proof/forced-failure-compensated-2026-10-27.json' with {type:'json'};

const RPC='https://atlantic.dplabs-internal.com';
const iface=new Interface(artifact.sagaAbi);
const tokenIface=new Interface(artifact.tokenAbi);
const check=(val,name)=>{if(val===null||val===undefined)throw new Error('Missing '+name);return val};
async function rpc(method,params=[]){
 let lastError;
 for(let attempt=0;attempt<3;attempt++){
  try{
   const res=await fetch(RPC,{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({jsonrpc:'2.0',id:51,method,params}),signal:AbortSignal.timeout(20000)});
   const payload=await res.json();
   if(!res.ok||payload.error)throw new Error(method+' '+JSON.stringify(payload.error||res.status));
   return payload.result;
  }catch(err){lastError=err;}
 }
 throw lastError;
}
async function call(to,abi,method,args,atBlock){
 const data=abi.encodeFunctionData(method,args);
 const result=await rpc('eth_call',[{to,data},atBlock]);
 return abi.decodeFunctionResult(method,check(result,method))[0];
}
async function verifyTx(entry,to,name){
 const receipt=check(await rpc('eth_getTransactionReceipt',[entry.transactionHash]),name+' receipt');
 const tx=check(await rpc('eth_getTransactionByHash',[entry.transactionHash]),name+' tx');
 assert.equal(receipt.transactionHash.toLowerCase(),entry.transactionHash.toLowerCase());
 assert.equal(Number(BigInt(receipt.status)),1,name+' must have real success receipt');
 assert.equal(receipt.blockNumber.toLowerCase(),entry.receiptBlock.toLowerCase());
 assert.equal(receipt.to.toLowerCase(),to.toLowerCase());
 assert.equal(receipt.from.toLowerCase(),proof.wallet.toLowerCase());
 assert.equal(tx.from.toLowerCase(),proof.wallet.toLowerCase());
 assert.equal(tx.to.toLowerCase(),to.toLowerCase());
 return receipt;
}
function sawEvent(receipt,name,amountWei){
 for(const log of receipt.logs||[]){
  if(log.address.toLowerCase()!==proof.contract.toLowerCase())continue;
  try{
   const e=iface.parseLog({topics:log.topics,data:log.data});
   if(e?.name===name&&e.args.account.toLowerCase()===proof.wallet.toLowerCase()
      &&e.args.amount===amountWei)return true;
  }catch{}
 }
 return false;
}
const chain=Number(BigInt(await rpc('eth_chainId')));
assert.equal(chain,688689);
assert.equal(proof.chainId,688689);
assert.equal(proof.outcome,'COMPENSATED');
const a=proof.steps[0],s=proof.steps[1],d=proof.steps[2],refund=proof.compensation[0];
assert.equal(d.transactionHash,null,'Do not fabricate a reverted deposit');
assert.equal(d.receiptStatus,null,'Business guard is NOT a reverted tx receipt');
const tokenA=await call(proof.contract,iface,'tokenA',[],refund.receiptBlock);
const aRc=await verifyTx(a,tokenA,'APPROVE');
const sRc=await verifyTx(s,proof.contract,'SWAP');
const fRc=await verifyTx(refund,proof.contract,'REFUND_A');
assert.ok(BigInt(aRc.blockNumber)<BigInt(sRc.blockNumber));
assert.ok(BigInt(sRc.blockNumber)<BigInt(fRc.blockNumber));
const amount=1000000000000000000n;
assert.ok(sawEvent(sRc,'Swapped',amount),'Missing real Swapped event');
assert.ok(sawEvent(fRc,'SwapCompensated',amount),'Missing real SwapCompensated event');
const pendingAtSwap=await call(proof.contract,iface,'pending',[proof.wallet],sRc.blockNumber);
const pendingAtRefund=await call(proof.contract,iface,'pending',[proof.wallet],fRc.blockNumber);
const sharesAtRefund=await call(proof.contract,iface,'deposited',[proof.wallet],fRc.blockNumber);
const approvedAtRefund=await call(tokenA,tokenIface,'allowance',[proof.wallet,proof.contract],fRc.blockNumber);
assert.equal(pendingAtSwap,amount,'SWAP did not lock expected test credit');
assert.equal(pendingAtRefund,0n,'REFUND must restore pending to zero');
assert.equal(sharesAtRefund,0n,'No vault shares should be minted during this failure');
assert.equal(approvedAtRefund,0n,'Allowance should be exhausted; no revoke is needed');
console.log(JSON.stringify({verified:true,chainId:chain,
  result:'COMPENSATED_WITH_ONCHAIN_REFUND',
  receipts:[aRc,sRc,fRc].map(r=>({hash:r.transactionHash,blockNumber:r.blockNumber,status:r.status})),
  storageAtRefund:{pendingWei:pendingAtRefund.toString(),depositedWei:sharesAtRefund.toString(),allowanceWei:approvedAtRefund.toString()},
  depositedThirdTx:false,
  note:'Verified independently from Pharos Atlantic RPC. Business-guard failure has no reverted DEPOSIT transaction hash.'
},null,2));

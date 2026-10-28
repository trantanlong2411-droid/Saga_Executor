import assert from 'node:assert/strict';
import {Interface} from 'ethers';
import artifact from '../public/contract.json' with {type:'json'};
import proof from '../proof/success-2026-10-28.json' with {type:'json'};

const RPC='https://atlantic.dplabs-internal.com';
const saga=new Interface(artifact.sagaAbi);
const token=new Interface(artifact.tokenAbi);
const present=(v,name)=>{if(v==null)throw Error('Missing '+name);return v};
async function rpc(method,params=[]){
 let err;
 for(let i=0;i<3;i++){
  try{
   const r=await fetch(RPC,{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({jsonrpc:'2.0',id:88,method,params}),signal:AbortSignal.timeout(20000)});
   const response=await r.json();
   if(!r.ok||response.error)throw Error(method+': '+JSON.stringify(response.error||r.status));
   return response.result;
  }catch(e){err=e}
 }
 throw err;
}
async function view(address,abi,fn,args,block){
 const raw=present(await rpc('eth_call',[{to:address,data:abi.encodeFunctionData(fn,args)},block]),fn);
 return abi.decodeFunctionResult(fn,raw)[0];
}
function assertEvent(receipt,abi,address,name,match){
 const decoded=[];
 for(const log of receipt.logs||[]){
  if(log.address.toLowerCase()!==address.toLowerCase())continue;
  try{
   const e=abi.parseLog({topics:log.topics,data:log.data});
   if(e?.name===name)decoded.push(e);
  }catch{}
 }
 assert.ok(decoded.some(match),'Expected '+name+' event from '+address);
}
async function receiptFor(step,to,method,abi){
 const [receipt,tx]=await Promise.all([
  rpc('eth_getTransactionReceipt',[step.transactionHash]),
  rpc('eth_getTransactionByHash',[step.transactionHash])
 ]);
 present(receipt,step.name+' receipt');present(tx,step.name+' tx');
 assert.equal(receipt.transactionHash.toLowerCase(),step.transactionHash.toLowerCase());
 assert.equal(tx.hash.toLowerCase(),step.transactionHash.toLowerCase());
 assert.equal(Number(BigInt(receipt.status)),1,step.name+' did not succeed on chain');
 assert.equal(receipt.blockNumber.toLowerCase(),step.receiptBlock.toLowerCase());
 for(const item of [receipt,tx]){
  assert.equal(item.from.toLowerCase(),proof.wallet.toLowerCase());
  assert.equal(item.to.toLowerCase(),to.toLowerCase());
 }
 assert.equal(tx.input.slice(0,10),abi.getFunction(method).selector);
 return receipt;
}
assert.equal(Number(BigInt(await rpc('eth_chainId'))),688689);
assert.equal(proof.chainId,688689);
assert.equal(proof.outcome,'SUCCEEDED');
assert.equal(proof.compensation.length,0);
const [approve,swap,deposit]=proof.steps;
assert.deepEqual(proof.steps.map(s=>s.name),['APPROVE','SWAP','DEPOSIT']);
const amount=1000000000000000000n;
const tokenA=await view(proof.contract,saga,'tokenA',[],deposit.receiptBlock);
const approveRc=await receiptFor(approve,tokenA,'approve',token);
const swapRc=await receiptFor(swap,proof.contract,'swap',saga);
const depositRc=await receiptFor(deposit,proof.contract,'deposit',saga);
assert.ok(BigInt(approveRc.blockNumber)<BigInt(swapRc.blockNumber),
  'SWAP must not precede APPROVE');
assert.ok(BigInt(swapRc.blockNumber)<BigInt(depositRc.blockNumber),
  'DEPOSIT must not precede SWAP');
assertEvent(approveRc,token,tokenA,'Approval',e=>
 e.args.owner.toLowerCase()===proof.wallet.toLowerCase()&&
 e.args.spender.toLowerCase()===proof.contract.toLowerCase()&&e.args.value===amount);
assertEvent(swapRc,saga,proof.contract,'Swapped',e=>
 e.args.account.toLowerCase()===proof.wallet.toLowerCase()&&e.args.amount===amount);
assertEvent(depositRc,saga,proof.contract,'Deposited',e=>
 e.args.account.toLowerCase()===proof.wallet.toLowerCase()&&e.args.amount===amount);
const allowanceAtApprove=await view(tokenA,token,'allowance',
 [proof.wallet,proof.contract],approveRc.blockNumber);
const pendingAtSwap=await view(proof.contract,saga,'pending',
 [proof.wallet],swapRc.blockNumber);
const pendingAtDeposit=await view(proof.contract,saga,'pending',
 [proof.wallet],depositRc.blockNumber);
const depositedAtDeposit=await view(proof.contract,saga,'deposited',
 [proof.wallet],depositRc.blockNumber);
assert.equal(allowanceAtApprove,amount,'APPROVE did not set expected allowance');
assert.equal(pendingAtSwap,amount,'SWAP did not create expected pending credit');
assert.equal(pendingAtDeposit,0n,'DEPOSIT did not clear pending credit');
assert.equal(depositedAtDeposit,amount,'DEPOSIT did not mint exactly one share');
console.log(JSON.stringify({
 verified:true,chainId:688689,result:'SUCCEEDED',
 receipts:[approveRc,swapRc,depositRc].map(r=>({hash:r.transactionHash,
  blockNumber:r.blockNumber,status:r.status})),
 events:['Approval','Swapped','Deposited'],
 storage:{
  allowanceAtApproveWei:allowanceAtApprove.toString(),
  pendingAtSwapWei:pendingAtSwap.toString(),
  pendingAtDepositWei:pendingAtDeposit.toString(),
  depositedAtDepositWei:depositedAtDeposit.toString()
 },
 note:'Verified on-chain receipts, contract events, sequential dependency blocks, and historical state. Success spans a paused/resumed session.'
},null,2));

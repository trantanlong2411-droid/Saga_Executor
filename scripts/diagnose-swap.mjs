import {Interface,formatEther} from 'ethers';
import artifact from '../public/contract.json' with {type:'json'};
const RPC='https://atlantic.dplabs-internal.com';
const HASH='0x530b552a9e146bd515c7757017d861d1b338bc06dd9d24c2769f586079828722';
const CONTRACT='0x934403227468426b33c26536dABC33b066B73f73';
const WALLET='0x74B2c2E4E4B771F0C75dcE44f40787468E323f79';
const abi=new Interface(artifact.sagaAbi);
async function rpc(method,params=[]){
 const r=await fetch(RPC,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:42,method,params}),signal:AbortSignal.timeout(20000)});
 const j=await r.json();
 if(!r.ok||j.error)throw Error(method+': '+JSON.stringify(j.error||r.status));
 return j.result;
}
async function read(fn,args,blockTag){
 const to=abi.encodeFunctionData(fn,args);
 const result=await rpc('eth_call',[{to:CONTRACT,data:to},blockTag]);
 return abi.decodeFunctionResult(fn,result)[0].toString();
}
const chain=await rpc('eth_chainId');
if(Number(BigInt(chain))!==688689)throw Error('Wrong chain');
const rec=await rpc('eth_getTransactionReceipt',[HASH]);
if(!rec)throw Error('Receipt not yet available');
const tx=await rpc('eth_getTransactionByHash',[HASH]);
const output={chain:688689,hash:HASH,tx:{
 from:tx?.from,to:tx?.to,method:tx?.input?.slice(0,10),blockNumber:tx?.blockNumber,
 status:rec.status,receiptTo:rec.to,receiptBlock:rec.blockNumber,
 gasUsed:rec.gasUsed,logs:rec.logs?.map(l=>({address:l.address,topics:l.topics,data:l.data}))
},readings:[]};
for(const block of [rec.blockNumber,'latest']){
 const row={at:block};
 for(const [fn,args] of [['pending',[WALLET]],['deposited',[WALLET]],['outstandingB',[]],['tokenA',[]],['tokenB',[]]]){
  try{row[fn]=await read(fn,args,block)}catch(e){row[fn+'Error']=e.message}
 }
 output.readings.push(row);
}
console.log(JSON.stringify(output,null,2));

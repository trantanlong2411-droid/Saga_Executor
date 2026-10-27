import {HTML} from './page.mjs';
import artifact from '../public/contract.json';
import {Interface} from 'ethers';
const sagaInterface=new Interface(artifact.sagaAbi);
const tokenInterface=new Interface(artifact.tokenAbi);
const CHAIN_ID=688689;
const RPC='https://atlantic.dplabs-internal.com';
function json(obj,status=200){return new Response(JSON.stringify(obj),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});}
async function rpc(method,params=[]){
 const response=await fetch(RPC,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',method,params,id:1}),signal:AbortSignal.timeout(11000)});
 if(!response.ok)throw new Error('Pharos Atlantic RPC HTTP '+response.status);
 const body=await response.json();
 if(body.error)throw new Error('Pharos Atlantic RPC error: '+(body.error.message||body.error.code));
 return body.result;
}
async function stateAt(contract,wallet,block){
 const contractCall=async(to,abi,fn,args)=>{
  const raw=await rpc('eth_call',[{to,data:abi.encodeFunctionData(fn,args)},block]);
  return abi.decodeFunctionResult(fn,raw)[0];
 };
 const tokenA=await contractCall(contract,sagaInterface,'tokenA',[]);
 const [pending,deposited,allowance,assetA]=await Promise.all([
  contractCall(contract,sagaInterface,'pending',[wallet]),
  contractCall(contract,sagaInterface,'deposited',[wallet]),
  contractCall(tokenA,tokenInterface,'allowance',[wallet,contract]),
  contractCall(tokenA,tokenInterface,'balanceOf',[wallet])
 ]);
 return {pendingWei:pending.toString(),depositedWei:deposited.toString(),
  allowanceWei:allowance.toString(),balanceAWei:assetA.toString(),tokenA};
}
export default {
 async fetch(req){
  const u=new URL(req.url);
  if(req.method!=='GET')return json({error:'Read-only web API: GET only'},405);
  if(u.pathname==='/')return new Response(HTML,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
  if(u.pathname==='/api/artifact')return json(artifact);
  if(u.pathname==='/api/health')return json({ok:true,skill:'saga-executor',network:'Pharos Atlantic Testnet',chainId:CHAIN_ID,
   compiled:Boolean(artifact.bytecode&&artifact.bytecode.length>20),contract:'SagaPlayground',readOnlyServer:true});
  if(u.pathname==='/api/network-fees'){
    const wallet=u.searchParams.get('wallet')||'';
    if(!/^0x[0-9a-fA-F]{40}$/.test(wallet))return json({ok:false,error:'Invalid EVM address'},400);
    try{
      const chain=await rpc('eth_chainId');
      if(Number(BigInt(chain))!==CHAIN_ID)throw new Error('RPC chain ID mismatch');
      const [gasHex,latestHex,pendingHex,balanceHex]=await Promise.all([
        rpc('eth_gasPrice'),
        rpc('eth_getTransactionCount',[wallet,'latest']),
        rpc('eth_getTransactionCount',[wallet,'pending']),
        rpc('eth_getBalance',[wallet,'latest'])
      ]);
      const gas=BigInt(gasHex);
      const fractional=gas%1000000000n;
      const gwei=(gas/1000000000n).toString()+
        (fractional===0n?'':'.'+fractional.toString().padStart(9,'0').replace(/0+$/,''));
      return json({ok:true,chainId:CHAIN_ID,
        gasPriceWei:gas.toString(),gasPriceGwei:gwei,
        confirmedNonce:Number(BigInt(latestHex)),pendingNonce:Number(BigInt(pendingHex)),
        balanceWei:BigInt(balanceHex).toString(),note:'RPC fee quote only. Wallet controls final gas display, nonce and signing.'});
    }catch(e){return json({ok:false,error:e.message},502)}
  }
  if(u.pathname==='/api/state'){
   const contract=u.searchParams.get('contract')||'';
   const wallet=u.searchParams.get('wallet')||'';
   const block=u.searchParams.get('block')||'latest';
   if(!/^0x[0-9a-fA-F]{40}$/.test(contract)||!/^0x[0-9a-fA-F]{40}$/.test(wallet)||
      !(block==='latest'||/^0x[0-9a-fA-F]{1,16}$/.test(block)))
     return json({ok:false,error:'Invalid contract, wallet or block'},400);
   try{
    const chain=await rpc('eth_chainId');
    if(Number(BigInt(chain))!==CHAIN_ID)throw new Error('RPC chain ID mismatch');
    const snapshot=await stateAt(contract,wallet,block);
    return json({ok:true,chainId:CHAIN_ID,contract,wallet,block,...snapshot});
   }catch(e){return json({ok:false,error:e.message},502)}
  }
  if(/^\/api\/tx\/0x[0-9a-fA-F]{64}$/.test(u.pathname)){
   const hash=u.pathname.slice('/api/tx/'.length);
   try{
    const chain=await rpc('eth_chainId');
    if(Number(BigInt(chain))!==CHAIN_ID)throw new Error('RPC chain ID mismatch');
    const r=await rpc('eth_getTransactionReceipt',[hash]);
    return json({ok:true,chainId:CHAIN_ID,receipt:r?{
      transactionHash:r.transactionHash,blockNumber:r.blockNumber,
      from:r.from,to:r.to,
      status:Number(BigInt(r.status)),gasUsed:r.gasUsed,
      contractAddress:r.contractAddress
    }:null});
   }catch(e){return json({ok:false,error:e.message},502)}
  }
  return json({error:'Not found'},404);
 }
};

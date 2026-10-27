import {HTML} from './page.mjs';
import artifact from '../public/contract.json';
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
export default {
 async fetch(req){
  const u=new URL(req.url);
  if(req.method!=='GET')return json({error:'Read-only web API: GET only'},405);
  if(u.pathname==='/')return new Response(HTML,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
  if(u.pathname==='/api/artifact')return json(artifact);
  if(u.pathname==='/api/health')return json({ok:true,skill:'saga-executor',network:'Pharos Atlantic Testnet',chainId:CHAIN_ID,
   compiled:Boolean(artifact.bytecode&&artifact.bytecode.length>20),contract:'SagaPlayground',readOnlyServer:true});
  if(/^\/api\/tx\/0x[0-9a-fA-F]{64}$/.test(u.pathname)){
   const hash=u.pathname.slice('/api/tx/'.length);
   try{
    const chain=await rpc('eth_chainId');
    if(Number(BigInt(chain))!==CHAIN_ID)throw new Error('RPC chain ID mismatch');
    const r=await rpc('eth_getTransactionReceipt',[hash]);
    return json({ok:true,chainId:CHAIN_ID,receipt:r?{
      transactionHash:r.transactionHash,blockNumber:r.blockNumber,
      status:Number(BigInt(r.status)),gasUsed:r.gasUsed,
      contractAddress:r.contractAddress
    }:null});
   }catch(e){return json({ok:false,error:e.message},502)}
  }
  return json({error:'Not found'},404);
 }
};

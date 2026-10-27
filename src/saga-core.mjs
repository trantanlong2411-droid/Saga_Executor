export const CHAIN=Object.freeze({
  chainId:688689,chainIdHex:'0xa8231',name:'Pharos Atlantic Testnet',
  rpc:'https://atlantic.dplabs-internal.com',
  explorer:'https://atlantic.pharosscan.xyz',symbol:'PHRS'
});
export const STEPS=['APPROVE','SWAP','DEPOSIT'];
export const STATES=Object.freeze({
  CREATED:'CREATED',RUNNING:'RUNNING',AWAITING_RECEIPT:'AWAITING_RECEIPT',
  SUCCEEDED:'SUCCEEDED',FAILED:'FAILED',COMPENSATING:'COMPENSATING',
  COMPENSATED:'COMPENSATED',NEEDS_RECONCILIATION:'NEEDS_RECONCILIATION'
});
export function assertReceipt(receipt,hash){
  if(!receipt||typeof receipt!=='object')throw new Error('Missing receipt; never advance');
  const actual=String(receipt.transactionHash||receipt.hash||'').toLowerCase();
  if(!/^0x[0-9a-f]{64}$/.test(actual)||actual!==String(hash).toLowerCase())
    throw new Error('Receipt transaction hash mismatch');
  const status=typeof receipt.status==='string'?
    Number(BigInt(receipt.status)):receipt.status;
  const block=receipt.blockNumber;
  if(block===undefined||block===null)throw new Error('Receipt has no block number');
  if(status!==1)throw new Error('Transaction reverted: receipt status '+status);
  return true;
}
export function classifyFailure(error,hadHash=false){
  const str=String(error?.shortMessage||error?.message||error||'').toLowerCase();
  if(hadHash)return 'CONFIRMATION_UNKNOWN';
  if(/user rejected|user denied|action_rejected|4001/.test(str))return 'USER_REJECTED';
  if(/execution reverted|call_exception|insufficient funds|invalid|not enough/.test(str))return 'PERMANENT';
  if(/429|503|502|network|timeout|rate limit|disconnected/.test(str))return 'TRANSIENT_BEFORE_BROADCAST';
  return 'UNKNOWN_BEFORE_BROADCAST';
}
export const retryScheduleMs=[0,1500,3500,7000,12000];
export function createRun({mode,wallet,contract,amount}){
  if(!['success','forced-failure'].includes(mode))throw new Error('Unknown run mode');
  if(!/^0x[a-f0-9]{40}$/i.test(wallet)||!/^0x[a-f0-9]{40}$/i.test(contract))
    throw new Error('Invalid wallet or contract');
  if(!/^\d+(?:\.\d+)?$/.test(String(amount))||!(Number(amount)>0))
    throw new Error('Invalid positive test amount');
  return {
    schema:'pharos-saga-v1',network:CHAIN.name,chainId:CHAIN.chainId,
    mode,wallet,contract,amount:String(amount),simulation:false,
    state:STATES.CREATED,startedAt:new Date().toISOString(),finishedAt:null,
    steps:STEPS.map(name=>({name,status:'PENDING',transactionHash:null,receiptBlock:null})),
    compensation:[],timeline:[{at:new Date().toISOString(),event:'CREATED'}]
  };
}
export function updateRun(run,event){
  if(!run||!event||!event.type)throw new Error('Missing transition');
  const result={...run,
    timeline:[...run.timeline,{at:new Date().toISOString(),event:event.type,
      step:event.step||null,hash:event.hash||null,detail:event.detail||null}]};
  if(event.type==='START')result.state=STATES.RUNNING;
  if(event.type==='STEP_SUBMITTED'){
    const index=STEPS.indexOf(event.step);
    if(index<0)throw new Error('Unknown saga step');
    if(result.steps.slice(0,index).some(x=>x.status!=='CONFIRMED'))throw new Error('Dependent prior step not confirmed');
    const steps=result.steps.map(x=>({...x}));
    steps[index]={...steps[index],status:'SUBMITTED',transactionHash:event.hash};
    result.steps=steps;result.state=STATES.AWAITING_RECEIPT;
  }
  if(event.type==='STEP_CONFIRMED'){
    const index=STEPS.indexOf(event.step);
    if(index<0)throw new Error('Unknown saga step');
    const steps=result.steps.map(x=>({...x}));
    if(steps[index].status!=='SUBMITTED')throw new Error('Cannot confirm unsent step');
    assertReceipt(event.receipt,steps[index].transactionHash);
    steps[index]={...steps[index],status:'CONFIRMED',receiptBlock:String(event.receipt.blockNumber)};
    result.steps=steps;result.state=STATES.RUNNING;
  }
  if(event.type==='STEP_FAILED'){
    const i=STEPS.indexOf(event.step);
    const steps=result.steps.map(x=>({...x}));
    if(i>=0)steps[i]={...steps[i],status:'FAILED',error:String(event.detail||'Reverted')};
    result.steps=steps;result.state=STATES.FAILED;
  }
  if(event.type==='UNKNOWN_CONFIRMATION')result.state=STATES.NEEDS_RECONCILIATION;
  if(event.type==='COMPENSATING')result.state=STATES.COMPENSATING;
  if(event.type==='COMPENSATED'){result.state=STATES.COMPENSATED;result.finishedAt=new Date().toISOString();}
  if(event.type==='SUCCEEDED'){
    if(result.steps.some(x=>x.status!=='CONFIRMED'))throw new Error('Cannot mark saga succeeded before 3 receipts');
    result.state=STATES.SUCCEEDED;result.finishedAt=new Date().toISOString();
  }
  return result;
}

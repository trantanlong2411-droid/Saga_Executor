import solc from 'solc';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const source=await readFile(new URL('../contracts/SagaPlayground.sol',import.meta.url),'utf8');
const input={language:'Solidity',
  sources:{'SagaPlayground.sol':{content:source}},
  settings:{optimizer:{enabled:true,runs:200},
    outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object']}}}};
const output=JSON.parse(solc.compile(JSON.stringify(input)));
const issues=output.errors||[];
for(const i of issues)console.error(i.formattedMessage);
if(issues.some(i=>i.severity==='error'))process.exit(1);
const contracts=output.contracts['SagaPlayground.sol'];
const saga=contracts.SagaPlayground;
const token=contracts.SagaToken;
if(!saga?.evm?.bytecode?.object||!token?.abi)throw new Error('Compiler did not produce contract artifact');
const artifact={version:1,network:'Pharos Atlantic Testnet',chainId:688689,
  contract:'SagaPlayground',compiler:solc.version(),sagaAbi:saga.abi,tokenAbi:token.abi,
  bytecode:'0x'+saga.evm.bytecode.object};
await mkdir(new URL('../public/',import.meta.url),{recursive:true});
await writeFile(new URL('../public/contract.json',import.meta.url),JSON.stringify(artifact));
console.log('SOLC_VERSION '+solc.version());
console.log('BYTECODE_CHARS '+artifact.bytecode.length);
console.log('COMPILE_SUCCESS contract '+artifact.contract+' abi '+artifact.sagaAbi.length+' entries');
console.log('ARTIFACT_BASE64 '+Buffer.from(JSON.stringify(artifact)).toString('base64'));

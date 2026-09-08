import {readdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'../..');
async function files(dir){return(await Promise.all((await readdir(dir,{withFileTypes:true})).filter(x=>!['node_modules','.next','brand-report','brand-test-results'].includes(x.name)).map(x=>x.isDirectory()?files(resolve(dir,x.name)):resolve(dir,x.name)))).flat();}
let bad=false;
for(const p of [...await files(resolve(root,'web/src')),...await files(resolve(root,'docs/brand')),...await files(resolve(root,'web/scripts'))]){
 if(!/\.(tsx?|css|mjs|md|json)$/.test(p))continue;
 const text=await readFile(p,'utf8');
 if(/[\t ]+$/m.test(text)||!text.endsWith('\n')){console.error(`Whitespace check failed: ${p}`);bad=true;}
}
if(bad)process.exitCode=1;else console.log('Formatting checks passed (trailing whitespace and final newlines).');

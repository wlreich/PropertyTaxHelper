import { readFile, readdir } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
const root=resolve(import.meta.dirname,'../..'), web=resolve(root,'web');
const errors=[];
const tokenFile=resolve(web,'src/styles/tokens.css');
const tokens=await readFile(tokenFile,'utf8');
const values=Object.fromEntries([...tokens.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(x=>[x[1],x[2].trim()]));
async function walk(dir){const entries=await readdir(dir,{withFileTypes:true}); return (await Promise.all(entries.map(x=>x.isDirectory()?walk(resolve(dir,x.name)):resolve(dir,x.name)))).flat();}
for(const path of await walk(resolve(web,'src'))){
 if(!/\.(css|tsx?)$/.test(path))continue;
 const text=await readFile(path,'utf8'),name=relative(root,path);
 if(path!==tokenFile && /#[\da-f]{3,8}\b|\brgba?\(/i.test(text))errors.push(`${name}: use a semantic color token`);
 if(path!==tokenFile && [...text.matchAll(/font-family\s*:\s*([^;]+);/gi)].some(x=>!x[1].trim().startsWith("var(")))errors.push(`${name}: use a semantic font token`);
 if(/outline\s*:\s*(?:none|0)(?:\s*[;!}])/i.test(text))errors.push(`${name}: do not remove focus outlines`);
 if(/guaranteed savings|fight back|definitely overpaying|guarantee a reduction|perfect comps/i.test(text))errors.push(`${name}: prohibited/high-risk claim`);
 if(/Property Tax Helper/.test(text))errors.push(`${name}: use ParcelSavvy in active UI`);
}
const core={'--color-brand-primary':'#0b2d4d','--color-brand-support':'#3f9de6','--color-brand-accent':'#f26b55','--color-action':'#1769aa','--color-text':'#173042','--color-text-muted':'#52697a','--color-background':'#f6f9fc','--color-border':'#d7e1e8'};
for(const [key,value] of Object.entries(core))if(values[key]?.toLowerCase()!==value)errors.push(`approved token changed: ${key}`);
function rgb(hex){return hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);}
function luminance(hex){const x=rgb(hex);return x[0]*.2126+x[1]*.7152+x[2]*.0722;}
function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
for(const fg of ['--color-brand-primary','--color-action','--color-text','--color-text-muted','--color-success','--color-warning','--color-error']){
 const ratio=contrast(values[fg],values['--color-surface']);if(ratio<4.5)errors.push(`${fg}: contrast ${ratio.toFixed(2)} below 4.5`);
}
if(contrast(values['--color-border-strong'],values['--color-surface'])<3)errors.push('control boundaries need 3:1');
if(!tokens.includes('--focus-ring:')||!tokens.includes('--font-heading: var(--font-manrope)')||!tokens.includes('--font-body: var(--font-inter)'))errors.push('missing required font/focus setup');
const manifest=JSON.parse(await readFile(resolve(root,'docs/brand/assets.sha256.json'),'utf8'));
for(const [file,expected] of Object.entries(manifest))if(createHash('sha256').update(await readFile(resolve(root,file))).digest('hex')!==expected)errors.push(`${file}: approved asset hash changed`);
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log('Brand checks passed: semantic colors/fonts, approved assets, contrast, focus and copy.');

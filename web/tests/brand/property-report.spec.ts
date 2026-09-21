import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {execFileSync} from 'node:child_process';

test('PAR-28 complete Letter reports preserve inventory, history and page furniture',async({page},info)=>{
 test.skip(info.project.name!=='width-1440','Four distinct pagination fixtures, generated once.');test.setTimeout(120_000);
 for(const [id,name,features,years] of [['999283','synthetic-reference',11,2],['999280','dense-inventory',26,2],['999281','long-history',0,26],['999282','limited-data',1,0]] as const){
  await page.goto(`/property/${id}/print`);await expect(page.getByRole('button',{name:'Print / save PDF',exact:true})).toBeEnabled();
  await expect(page.locator('[data-report-record^="feature-"]:not([data-report-record^="feature-change-"])')).toHaveCount(features);
  await expect(page.locator('[data-report-record^="history-"]')).toHaveCount(years);
  if(id==='999283'){await expect(page.locator('.property-report')).toContainText('$50,000');await expect(page.locator('#report-neighborhood')).toHaveText('Your home, in context');}
  if(id==='999280')await expect(page.locator('[data-report-continuation]')).not.toHaveCount(0);
  if(id==='999282'){await expect(page.locator('.property-report')).toContainText('certified result is not available');await expect(page.locator('.property-report')).not.toContainText('Conditional 10% ceiling');}
  const path=info.outputPath(`${name}.pdf`);await page.pdf({path,preferCSSPageSize:true,printBackground:true});await info.attach(name,{path,contentType:'application/pdf'});
  const pages=JSON.parse(execFileSync('python3',['-c','from pypdf import PdfReader; import json,sys; print(json.dumps([p.extract_text() for p in PdfReader(sys.argv[1]).pages]))',path],{encoding:'utf8'})) as string[];
  console.log(`PAR28_PAGES ${name} ${pages.length}`);
  expect(pages.length).toBe({'synthetic-reference':7,'dense-inventory':9,'long-history':9,'limited-data':1}[name]);
  for(const [i,text] of pages.entries()){expect(text.trim().length).toBeGreaterThan(100);expect(text).toContain(`Property ${id} | 2026`);expect(text).toContain(`${i+1} / ${pages.length}`);expect(text).not.toContain('Return to property overview');const normalized=text.replace(/\s+/g,' ');if(normalized.includes('What makes up your value'))expect(normalized).toContain('Recorded valuation components');if(normalized.includes('Your assessment over time')){expect(normalized).toContain('2026');expect(normalized).toContain('2025');}}
  const text=pages.join('\n');expect(text).toContain('Source coverage');expect(text).not.toContain('Compare similar properties');
  if(id==='999280')for(let i=1;i<=26;i++)expect(text).toContain(`Feature ${String(i).padStart(2,'0')}`);
  if(id==='999281')for(let i=0;i<26;i++)expect(text.match(new RegExp(`${2026-i-(i>15?1:0)}\\s*·\\s*Certified`,'g'))).toHaveLength(1);
 }
 await page.goto('/property/999280/print');await expect(page.getByRole('button',{name:'Print / save PDF',exact:true})).toBeEnabled();await page.addStyleTag({content:'@page {size:A4;} .property-report {--color-action:#333;--color-success:#666;--color-surface-info:#eee;--color-text:#111;--color-text-muted:#444;} .report-heading img {filter:grayscale(1);}'});
 const path=info.outputPath('dense-a4-grayscale.pdf');await page.pdf({path,preferCSSPageSize:true,printBackground:true});await info.attach('A4 grayscale',{path,contentType:'application/pdf'});expect(Number(execFileSync('python3',['-c','from pypdf import PdfReader; import sys; print(len(PdfReader(sys.argv[1]).pages))',path],{encoding:'utf8'}).trim())).toBe(8);
});

test('PAR-28 keyboard print entry, retained release, narrow preview and return',async({page},info)=>{
 test.skip(info.project.name!=='width-375','One narrow keyboard journey.');
 await page.goto('/property/999283');const entry=page.getByRole('link',{name:'Print / save property report',exact:true});await expect(entry).toHaveAttribute('href',/release=28261111-1111-4111-8111-111111111111/);await entry.focus();await entry.press('Enter');
 await expect(page.locator('.property-report')).toHaveAttribute('data-report-property','999283');await expect(page.locator('.property-report')).toHaveAttribute('data-report-year','2026');
 const print=page.getByRole('button',{name:'Print / save PDF',exact:true});await expect(print).toBeEnabled();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
 await page.evaluate(()=>{window.print=()=>{document.body.dataset.printRequested='yes';};});await print.focus();await print.press('Enter');await expect(page.locator('body')).toHaveAttribute('data-print-requested','yes');
 await page.getByRole('link',{name:'← Return to property overview',exact:true}).click();await expect(page).toHaveURL(/\/property\/999283$/);
 await page.goto('/property/999283/print?release=28251111-1111-4111-8111-111111111111');await expect(page.locator('.property-report')).toHaveAttribute('data-report-year','2025');
 await page.goto('/property/999283/print?release=missing');await expect(page.getByRole('heading',{name:'Requested assessment unavailable'})).toBeVisible();await expect(print).toHaveCount(0);
});

import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {execFileSync} from 'node:child_process';
const scope=(selected:string[])=>new URLSearchParams({targetYear:'2027',evidenceStart:'2026-01-01',evidenceEnd:'2026-12-31',activityType:'single_family',activitySort:'address',activitySelected:JSON.stringify(selected)});
const pdfText=(path:string)=>JSON.parse(execFileSync('python3',['-c','from pypdf import PdfReader; import json,sys; print(json.dumps([p.extract_text() for p in PdfReader(sys.argv[1]).pages]))',path],{encoding:'utf8'})) as string[];
test('PAR-29 populated and long shortlist reports preserve every selected record',async({page},info)=>{
 test.skip(info.project.name!=='width-1440','Two Letter cases and one A4 fallback.');test.setTimeout(120_000);
 for(const [id,name,selected] of [['9200','populated',['120:s:2','123:j:7']],['9290','long-shortlist',Array.from({length:24},(_,i)=>`${9400+i}:j:long${i}`)]] as const){
  await page.goto(`/property/${id}/neighborhood/print?${scope([...selected])}`);await expect(page.getByRole('heading',{name:'Your neighborhood, in context.',exact:true})).toBeVisible();await page.evaluate(()=>document.fonts.ready);
  await expect(page.locator('.activity-print tbody tr')).toHaveCount(selected.length);await expect(page.locator('.nbr-story')).toContainText('12 matched homes');await expect(page.locator('.nbr-story .neighborhood-story-stage')).toHaveCount(3);await expect(page.locator('.nbr-outcome')).toContainText('10 / 12');
  const path=info.outputPath(`${name}.pdf`);await page.pdf({path,preferCSSPageSize:true,printBackground:true});await info.attach(name,{path,contentType:'application/pdf'});const pages=pdfText(path);console.log(`PAR29_PAGES ${name} ${pages.length}`);expect(pages.length).toBe(name==='populated'?2:5);
  for(const [i,t] of pages.entries()){expect(t.trim().length).toBeGreaterThan(120);expect(t).toContain(`Property ${id} | 2026 certified`);expect(t).toContain(`${i+1} / ${pages.length}`);expect(t).not.toContain('Back to neighborhood analysis');if(/Property\s+94\d\d/.test(t)){expect(t).toContain('Transaction dates');expect(t).toContain('Record / price');}}
  const text=pages.join('\n');for(const key of selected)expect(text.match(new RegExp('Property\\s+'+key.split(':')[0]+'\\b','g'))).toHaveLength(1);expect(text).toContain('2027');expect(text).toContain('2026-01-01');expect(text).toContain('not proof of a sale');expect(text).not.toMatch(/NaN|Infinity/);
 }
 await page.addStyleTag({content:'@page {size:A4;} .print-report {--color-action:#333;--color-surface-info:#eee;--color-text:#111;--color-text-muted:#444;} .print-header img {filter:grayscale(1);}'});const path=info.outputPath('long-shortlist-a4-gray.pdf');await page.pdf({path,preferCSSPageSize:true,printBackground:true});await info.attach('A4 grayscale',{path,contentType:'application/pdf'});expect(pdfText(path)).toHaveLength(4);expect(pdfText(path).join('\n').match(/Property\s+94\d\d\b/g)).toHaveLength(24);
 await page.goto('/property/9204/neighborhood/print?targetYear=2025&evidenceStart=2024-01-01&evidenceEnd=2024-12-31');await expect(page.locator('.print-report')).toContainText('Unavailable');await expect(page.locator('.print-report')).toContainText('Coverage unavailable for 2024');await expect(page.locator('.activity-print')).toContainText('No available records selected');await expect(page.locator('.print-report')).not.toContainText(/NaN|Infinity/);
});
test('PAR-29 narrow keyboard print and Back retain research and shortlist state',async({page},info)=>{
 test.skip(info.project.name!=='width-375','One narrow keyboard journey.');
 const query=scope(['120:s:2','123:j:7']);await page.goto(`/property/100/neighborhood?${query}`);
 const printLink=page.getByRole('link',{name:'Print / save PDF',exact:true});await printLink.focus();await printLink.press('Enter');await expect(page.locator('.activity-print tbody tr')).toHaveCount(2);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
 await page.evaluate(()=>{window.print=()=>{document.body.dataset.printRequested='yes';};});const print=page.getByRole('button',{name:'Print or save as PDF'});await print.focus();await print.press('Enter');await expect(page.locator('body')).toHaveAttribute('data-print-requested','yes');
 const back=page.getByRole('link',{name:'Back to neighborhood analysis'});await expect(back).toHaveAttribute('href',`/property/100/neighborhood?${query}`);await back.focus();await back.press('Enter');await expect(page).toHaveURL(new RegExp('/property/100/neighborhood\\?'));await expect(page.locator('.activity-shortlist')).toContainText('2');
});

test('PAR-29 small cohort is count-first and chart ranges have text equivalents',async({page},info)=>{
 test.skip(info.project.name!=='width-1440','One targeted report semantics check.');
 await page.goto('/property/9203/neighborhood/print');
 const metric=page.locator('.nbr-story').getByText('Proposed vs prior certified',{exact:true}).locator('..');await expect(metric.locator('dd').first()).toHaveText('3 matched homes');
 const ranges=page.getByRole('list',{name:'Market-value ranges'});await expect(ranges.getByRole('listitem')).toHaveCount(8);await expect(ranges).toContainText('homes');await expect(ranges).toContainText('upper boundary excluded');
});

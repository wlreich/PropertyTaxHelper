import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {readFile} from 'node:fs/promises';
test('activity filters, keyboard selection, shortlist and responsive layout',async({page},info)=>{
 await page.goto('/property/100/neighborhood');
 const section=page.locator('#recent-activity'),rows=section.locator('tbody tr');
 await expect(section.getByRole('heading')).toHaveText('Recent sales & ownership changes');
 await expect(section.locator('.activity-count')).toContainText('6 properties');
 await expect(rows).toHaveCount(5);
 await expect(section.getByRole('button',{name:'Download realtor shortlist'})).toBeDisabled();
 const first=section.getByRole('checkbox').first();await first.focus();await page.keyboard.press('Space');await expect(first).toBeChecked();
 await section.getByRole('combobox',{name:'Property type',exact:true}).selectOption('land');
 await expect(rows).toHaveCount(1);await expect(section.locator('.activity-shortlist')).toContainText('Includes selections outside this filter.');
 await section.getByRole('combobox',{name:'Property type',exact:true}).selectOption('all');
 await section.getByRole('checkbox').nth(1).check();
 await expect(section.locator('.activity-shortlist')).toContainText('2 properties selected');
 const downloading=page.waitForEvent('download');await section.getByRole('button',{name:'Download realtor shortlist'}).click();const download=await downloading;
 expect(download.suggestedFilename()).toBe('ParcelSavvy-T2450-2026-realtor-shortlist.csv');
 const csv=await readFile((await download.path())!,'utf8');expect(csv).toContain('Sale unconfirmed');expect(csv).toContain('650000');expect(csv).toContain('2026-08-27');expect(csv).not.toContain('122 CYPRESS');
 await section.getByRole('button',{name:'Clear selection'}).click();await expect(section.getByRole('checkbox').first()).not.toBeChecked();
 await section.getByRole('button',{name:'View all 7 →'}).click();await expect(rows).toHaveCount(7);
 await section.getByRole('combobox',{name:'Sort activity'}).selectOption('oldest');await expect(rows.first()).toContainText('May 25, 2026');
 expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await section.getByRole('combobox',{name:'Sort activity'}).selectOption('newest');await section.getByRole('button',{name:'Show first five'}).click();await section.getByRole('checkbox').first().check();
 await page.evaluate(()=>document.fonts.ready);
 const width=info.project.use.viewport!.width;
 if(width===375||width===1440){
  const path=info.outputPath('activity-'+width+'.png');const png=await section.screenshot({path});await info.attach('Activity layout',{path,contentType:'image/png'});
  // Bounded synthetic screenshots remain reviewable when artifact downloads are unavailable.
  if(process.env.CI){const b64=png.toString('base64');for(let i=0;i<b64.length;i+=4000)console.log('ACTIVITY_REVIEW_'+width+'_'+i+':'+b64.slice(i,i+4000));}
 }
 if(width===1440){await page.evaluate(()=>{document.documentElement.style.zoom='2';});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.evaluate(()=>{document.documentElement.style.zoom='1';});}
 if(width===375){await page.setViewportSize({width:320,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 await section.getByRole('combobox',{name:'Activity year'}).selectOption('2025');await expect(section.locator('.activity-count')).toContainText('1 property with 2025');await expect(section.getByRole('button',{name:'Download realtor shortlist'})).toBeDisabled();
 await page.goto('/property/9204/neighborhood');await expect(page.locator('#recent-activity')).toContainText('No matching activity appears');
 await page.goto('/property/9205/neighborhood');await expect(page.locator('#recent-activity')).toContainText('This does not mean no properties sold');
});

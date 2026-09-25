import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {readFile} from 'node:fs/promises';
test('activity filters, keyboard selection, shortlist and responsive layout',async({page},info)=>{
 await page.goto('/property/100/neighborhood');
 const section=page.locator('#recent-activity'),rows=section.locator('tbody tr');
 await expect(section.getByRole('heading')).toHaveText('Recent sales & ownership changes');
 await expect(section.locator('.activity-count')).toContainText('6 properties');
 await expect(section.locator('.activity-count')).toHaveAttribute('aria-describedby','activity-coverage-note activity-record-note');
 await expect(rows).toHaveCount(5);
 await expect(rows.filter({hasText:'Deed change · Sale unconfirmed'})).toHaveCount(2);
 await expect(section.getByRole('button',{name:'Download realtor shortlist'})).toBeDisabled();
 const first=section.getByRole('checkbox').first();await first.focus();await page.keyboard.press('Space');await expect(first).toBeChecked();
 await section.getByRole('combobox',{name:'Property type',exact:true}).selectOption('land');
 await expect(rows).toHaveCount(1);await expect(section.locator('.activity-shortlist')).toContainText('Includes selections outside this filter.');
 await section.getByRole('combobox',{name:'Property type',exact:true}).selectOption('all');
 await section.getByRole('checkbox').nth(1).check();
 await expect(section.locator('.activity-shortlist')).toContainText('2 properties selected');
 const downloading=page.waitForEvent('download');await section.getByRole('button',{name:'Download realtor shortlist'}).click();const download=await downloading;
 expect(download.suggestedFilename()).toBe('ParcelSavvy-T2450-2027-realtor-shortlist.csv');
 const csv=await readFile((await download.path())!,'utf8');expect(csv).toContain('Sale unconfirmed');expect(csv).toContain('650000');expect(csv).toContain('2026-08-27');expect(csv).not.toContain('122 CYPRESS');expect(csv).toContain('Sale price reported by Appraisal District');expect(csv).not.toContain('TCAD');
 await section.getByRole('button',{name:'Clear selection'}).click();await expect(section.getByRole('checkbox').first()).not.toBeChecked();
 await section.getByRole('button',{name:'View all 7 → · newest first'}).click();await expect(rows).toHaveCount(7);
 await section.getByRole('combobox',{name:'Sort activity'}).selectOption('oldest');await expect(rows.first()).toContainText('May 25, 2026');
 expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await section.getByRole('combobox',{name:'Sort activity'}).selectOption('newest');await section.getByRole('button',{name:'Show first five newest records'}).click();await section.getByRole('checkbox').first().check();
 await page.evaluate(()=>document.fonts.ready);
 const width=info.project.use.viewport!.width;
 if(width===375||width===1440){
  if(width===375)await page.setViewportSize({width:390,height:1000});
  const path=info.outputPath('activity-'+width+'.png');const png=await section.screenshot({path});await info.attach('Activity layout',{path,contentType:'image/png'});
  // Bounded synthetic screenshots remain reviewable when artifact downloads are unavailable.
  if(process.env.CI){const b64=png.toString('base64');for(let i=0;i<b64.length;i+=4000)console.log('ACTIVITY_REVIEW_'+width+'_'+i+':'+b64.slice(i,i+4000));}
 }
 if(width===1440){await page.evaluate(()=>{document.documentElement.style.zoom='2';});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.evaluate(()=>{document.documentElement.style.zoom='1';});}
 if(width===375){await page.setViewportSize({width:320,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 await section.getByLabel('Preparing for').fill('2026');await section.getByRole('button',{name:'Apply dates'}).click();await expect(section.locator('.activity-count')).toContainText('1 property with recorded activity');
 await page.goto('/property/9204/neighborhood');await expect(page.locator('#recent-activity')).toContainText('No matching activity appears');
 await page.goto('/property/9205/neighborhood');const unavailable=page.locator('#recent-activity');await expect(unavailable).toContainText('Property activity is not available for this view. This does not mean no properties sold.');
});

test('neighborhood date window stays local while comparison uses its assessment release',async({page},info)=>{
 test.skip(info.project.name!=='width-1440','one focused integration journey');
 await page.goto('/property/100/neighborhood');const activity=page.locator('#recent-activity');
 await activity.getByLabel('Evidence start').fill('2026-06-01');await activity.getByLabel('Evidence end').fill('2026-06-30');await activity.getByRole('button',{name:'Apply dates'}).click();
 await expect(page).toHaveURL(/evidenceStart=2026-06-01/);await expect(activity.getByRole('button',{name:'Apply dates'})).toBeEnabled();
 await expect(activity.locator('tbody tr')).toHaveCount(5);await activity.getByRole('checkbox').nth(1).check();
 await activity.getByRole('combobox',{name:'Property type',exact:true}).selectOption('land');
 const downloadPromise=page.waitForEvent('download');await activity.getByRole('button',{name:'Download realtor shortlist'}).click();const download=await downloadPromise;
 const csv=await readFile((await download.path())!,'utf8');for(const text of ['2027','2026-06-01','2026-06-30','120 CYPRESS','Land only','Single-family homes','Retained outside filter'])expect(csv).toContain(text);
 await page.getByRole('link',{name:'Print / save PDF',exact:true}).click();const report=page.locator('.activity-print');
 await expect(report).toContainText('Preparing for 2027');await expect(report).toContainText('2026-06-01–2026-06-30');await expect(report.locator('tbody tr')).toHaveCount(1);await expect(report).toContainText('120 CYPRESS');
 const liveLink=new URL((await page.locator('.print-report-footer a').getAttribute('href'))!);expect(liveLink.searchParams.get('evidenceStart')).toBe('2026-06-01');expect(liveLink.searchParams.get('evidenceEnd')).toBe('2026-06-30');expect(liveLink.searchParams.get('activityType')).toBe('land');expect(JSON.parse(liveLink.searchParams.get('activitySelected')!)).toHaveLength(1);
 await page.pdf({path:info.outputPath('par32-shortlist.pdf'),format:'Letter',printBackground:true});
 await page.getByRole('link',{name:'← Back to neighborhood analysis'}).click();await expect(activity.getByRole('combobox',{name:'Property type',exact:true})).toHaveValue('land');await expect(activity.locator('.activity-shortlist')).toContainText('1 property selected');
 await activity.getByLabel('Preparing for').fill('2025');await activity.getByRole('button',{name:'Apply dates'}).click();await expect(activity).toContainText('Coverage unavailable for 2024');await expect(activity).toContainText('Unavailable years do not mean no properties sold');
 await expect(activity.getByRole('button',{name:'Clear selection'})).toBeEnabled();await activity.getByRole('button',{name:'Clear selection'}).click();await expect(activity).not.toContainText('Some saved selections are outside this window');
 await activity.getByLabel('Preparing for').fill('2027');await activity.getByLabel('Evidence start').fill('2026-06-01');await activity.getByLabel('Evidence end').fill('2026-06-30');await activity.getByRole('button',{name:'Apply dates'}).click();await expect(page).toHaveURL(/targetYear=2027/);await expect(activity.getByRole('button',{name:'Apply dates'})).toBeEnabled();
 await activity.getByRole('checkbox').nth(1).check();
 const compareNav=page.getByRole('navigation',{name:'Property tools'}).getByRole('link',{name:'Compare properties',exact:true});await expect(compareNav).toHaveAttribute('href','/property/100/compare');
 await activity.getByRole('link',{name:'Compare similar properties',exact:true}).click();
 await expect(page).toHaveURL(/\/property\/100\/compare$/);await expect(page.getByLabel('Assessment release')).toHaveValue('11111111-1111-4111-8111-111111111111');
 for(const label of ['Preparing for','Evidence start','Evidence end'])await expect(page.getByLabel(label,{exact:true})).toHaveCount(0);
 await page.goBack();await expect(activity.getByLabel('Evidence end')).toHaveValue('2026-06-30');await expect(activity.locator('.activity-shortlist')).toContainText('1 property selected');
 await page.goto('/property/100/compare?step=results&selected=120&targetYear=2027&evidenceStart=2026-06-01&evidenceEnd=2026-06-30&activityYear=2026');
 const clue=page.locator('.comparison-deed').first();await clue.locator('summary').click();await expect(clue).toContainText('2025-01-01–2025-12-31');await expect(clue).toContainText('2026 assessment release');
 await page.getByRole('button',{name:'Estimated adjusted values',exact:true}).click();await expect(page.getByRole('region',{name:'ParcelSavvy estimated adjusted values'})).toBeVisible();const normalized=new URL(page.url());for(const key of ['targetYear','evidenceStart','evidenceEnd','activityYear'])expect(normalized.searchParams.has(key)).toBe(false);
 await page.goBack();await page.goBack();await expect(activity.getByLabel('Evidence end')).toHaveValue('2026-06-30');
 await activity.getByLabel('Preparing for').fill('2025');await activity.getByRole('button',{name:'Apply dates'}).click();await expect(activity).toContainText('Coverage unavailable for 2024');await expect(activity).toContainText('Unavailable years do not mean no properties sold');
});

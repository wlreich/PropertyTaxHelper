import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {readFile} from 'node:fs/promises';
test('PAR-38 closest sort preserves filters, selection, export and comparison descriptions',async({page},info)=>{
 test.skip(info.project.name!=='width-1440','One desktop journey.');
 await page.goto('/property/100/neighborhood');const activity=page.locator('#recent-activity'),sort=activity.getByRole('combobox',{name:'Sort activity'});
 await expect(sort).toHaveValue('newest');const row=activity.locator('tbody tr').filter({has:page.locator('a[href="/property/120"]')});await expect(row.locator('.comparison-tier')).toHaveText('Tier 0 · Closest');const description=await row.locator('.comparison-small').innerText();
 await row.getByRole('checkbox').check();await activity.getByRole('combobox',{name:'Property type',exact:true}).selectOption('single_family');await sort.selectOption('closest');await expect(row.getByRole('checkbox')).toBeChecked();await expect(activity.locator('tbody tr').first()).toContainText('Property 100');
 const event=page.waitForEvent('download');await activity.getByRole('button',{name:'Download realtor shortlist'}).click();const download=await event,csv=await readFile((await download.path())!,'utf8');expect(csv.split('\r\n').filter(Boolean)).toHaveLength(2);expect(csv).toContain('"120"');expect(csv).toContain('650000');expect(csv).toContain('closest');
 await activity.getByRole('combobox',{name:'Property type',exact:true}).selectOption('all');await activity.getByRole('button',{name:'View all 7 → · closest matches first'}).click();await expect(activity.locator('tbody tr')).toHaveCount(7);await expect(activity.getByRole('button',{name:'Show first five closest matches'})).toBeVisible();
 const path=info.outputPath('par38-desktop.png');await activity.screenshot({path});await info.attach('Activity matches desktop',{path,contentType:'image/png'});
 await row.getByRole('link').click();await expect(page).toHaveURL(/\/property\/120$/);await expect(page.getByRole('heading',{level:1})).toContainText('120');
 await page.goto('/property/100/compare?selected=120&step=results');const compared=page.locator('.comparison-rows tbody tr').filter({hasText:'120 CYPRESS'});await expect(compared.locator('.comparison-tier')).toHaveText('Tier 0 · Closest');await expect(compared).toContainText(description);
});
test('PAR-38 narrow match text and closest sort remain keyboard accessible',async({page},info)=>{
 test.skip(info.project.name!=='width-375','One narrow pass.');
 await page.goto('/property/100/neighborhood');const activity=page.locator('#recent-activity'),sort=activity.getByRole('combobox',{name:'Sort activity'});await sort.focus();await sort.press('End');await sort.press('Enter');await expect(sort).toHaveValue('closest');
 const check=activity.getByRole('checkbox').first();await check.focus();await check.press('Space');await expect(check).toBeChecked();await expect(activity.locator('.comparison-tier').first()).toBeVisible();await expect(activity.locator('.comparison-small').first()).toContainText('Same living area');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
 const path=info.outputPath('par38-mobile.png');await activity.screenshot({path});await info.attach('Activity matches mobile',{path,contentType:'image/png'});
});

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('PAR-25 compact ledger, year dialog, provenance and focus restoration',async({page},info)=>{
  await page.goto('/property/736164');
  const history=page.getByRole('region',{name:'Assessment & protest history'});
  const hero=await page.locator('.current-assessment').textContent();
  await expect(history.locator('.annual-value-row')).toHaveCount(2);
  const current=history.locator('[data-year="2026"]'), prior=history.locator('[data-year="2025"]');
  for(const value of ['$1,575,313','$1,377,354','Unchanged']) await expect(current).toContainText(value);
  await expect(prior.locator('td').nth(0)).toHaveText('Proposed market$1,365,039');
  await expect(prior).toContainText('$1,252,140');
  await expect(history.getByRole('button',{name:'Older years'})).toHaveCount(0);
  await expect(history.locator('.annual-trend')).not.toHaveAttribute('open','');
  for(const forbidden of ['Two years','View full record history','coming soon','2025 preliminary source']) await expect(history).not.toContainText(forbidden);
  if(info.project.use.viewport!.width===1440) {
    const cells=await current.locator('td').all(), headers=await history.locator('thead th').all();
    for(let i=0;i<cells.length;i++) {
      await expect(cells[i]).toHaveCSS('text-align','right');
      const a=(await cells[i].boundingBox())!,b=(await headers[i+1].boundingBox())!;
      expect(Math.abs(a.x+a.width-b.x-b.width)).toBeLessThan(1);
    }
  }
  expect((await page.locator('.overview-context').boundingBox())!.y).toBeLessThan((await history.boundingBox())!.y);
  await expect(page.locator('.homeowner-representation')).toHaveCount(0);
  await history.screenshot({path:info.outputPath('par25-history.png')});
  const trigger=history.getByRole('button',{name:'View 2025 details'});
  await trigger.focus();await page.keyboard.press('Enter');
  const dialog=page.getByRole('dialog',{name:'2025 assessment & protest record'});
  await expect(dialog).toBeVisible();await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(dialog).toContainText('Certified change from 2024: market Not available');
  await dialog.locator('summary').filter({hasText:'Source releases'}).click();
  for(const value of ['May 8, 2025','2025 interim snapshot','Jul 3, 2025','Jul 19, 2025','Residence homestead','Home & improvements'])await expect(dialog).toContainText(value);
  await dialog.locator('summary').filter({hasText:'Dated protest'}).click();await expect(dialog).toContainText('No protest found');
  await dialog.getByRole('button',{name:'Close record'}).focus();await page.keyboard.press('Shift+Tab');
  expect(await dialog.evaluate(n=>n.contains(document.activeElement))).toBe(true);
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  expect(await dialog.evaluate(n=>n.scrollWidth<=n.clientWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('par25-year-dialog.png')});
  await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();
  expect(await page.locator('.current-assessment').textContent()).toBe(hero);
  const currentRecord=page.getByRole('button',{name:'View 2026 assessment & protest record'});
  await currentRecord.click();await expect(page.getByRole('dialog')).toContainText('+$210,274 / 15.4%');
  await page.getByRole('button',{name:'Close record'}).click();await expect(currentRecord).toBeFocused();
  await history.locator('.annual-trend summary').click();await expect(history.locator('.annual-chart-year')).toHaveCount(2);
  await expect(history).toContainText('widened from $112,899 in 2025 to $197,959 in 2026');
  await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.evaluate(()=>{document.documentElement.style.fontSize='';document.documentElement.style.zoom='2';});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.evaluate(()=>{document.documentElement.style.zoom='';});
  if(info.project.use.viewport!.width===1440)await page.pdf({path:info.outputPath('property-overview-print-review.pdf'),format:'Letter',printBackground:true});
});

test('PAR-25 one, five and six years stay bounded through navigation and dialogs',async({page},info)=>{
  for(const [id,count,earlier] of [['999111',1,false],['999115',5,false],['999116',5,true]] as const) {
    await page.goto(`/property/${id}`);const history=page.locator('.annual-history');
    await expect(history.locator('.annual-value-row')).toHaveCount(count);
    await expect(history.getByRole('button',{name:'Older years'})).toHaveCount(earlier?1:0);
    if(earlier) {
      const hero=await page.locator('.current-assessment').textContent();await history.getByRole('button',{name:'Older years'}).click();
      await expect(history.locator('.annual-value-row')).toHaveCount(1);await expect(history.locator('[role="status"]')).toContainText('Page 2 of 2');
      await expect(history.getByRole('button',{name:'Older years'})).toBeDisabled();
      const trigger=history.getByRole('button',{name:'View 2021 details'});await trigger.click();
      const dialog=page.getByRole('dialog');await dialog.locator('summary').filter({hasText:'Source releases'}).click();
      await expect(dialog).toContainText('Apr 2, 2021');await dialog.getByRole('button',{name:'Close record'}).click();
      await expect(trigger).toBeFocused();await expect(history.locator('.annual-value-row')).toHaveCount(1);
      await history.screenshot({path:info.outputPath('par25-older-page.png')});
      await history.getByRole('button',{name:'Newer years'}).click();await expect(history.locator('.annual-value-row')).toHaveCount(5);
      expect(await page.locator('.current-assessment').textContent()).toBe(hero);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
});

test('PAR-25 missing, nonconsecutive, preliminary-only and excluded-baseline histories',async({page})=>{
  await page.goto('/property/999110');await expect(page.locator('.annual-history')).toContainText('No annual assessment records');await expect(page.locator('.annual-table')).toHaveCount(0);
  await page.goto('/property/999117');await page.getByRole('button',{name:'View 2026 details'}).click();
  await expect(page.getByRole('dialog')).toContainText('Certified change from 2025: market Not available');await page.keyboard.press('Escape');
  await page.goto('/property/999118');const future=page.locator('[data-year="2027"]');
  await expect(future).toContainText('Preliminary only');await expect(future.locator('td').nth(0)).toContainText('$685,000');
  for(const i of [1,2])await expect(future.locator('td').nth(i)).toContainText('Not available');
  await page.getByRole('button',{name:'View 2027 details'}).click();await expect(page.getByRole('dialog').locator('.annual-detail-comparison')).toContainText('$590,000');await page.keyboard.press('Escape');
  await page.goto('/property/999119');const row=page.locator('[data-year="2025"]');
  for(const i of [0,2])await expect(row.locator('td').nth(i)).toContainText('Not available');
  await page.getByRole('button',{name:'View 2025 details'}).click();const dialog=page.getByRole('dialog');
  await dialog.locator('summary').filter({hasText:'Source releases'}).click();await expect(dialog).toContainText('$1,365,039');
  await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});expect(await dialog.evaluate(n=>n.scrollWidth<=n.clientWidth)).toBe(true);
});

test('PAR-25 partial outages preserve known protest records without inferring unchecked status',async({page})=>{
 await page.goto('/property/999120');const history=page.locator('.annual-history');
 await expect(history).toContainText('Some assessment history is temporarily unavailable');
 await expect(history.locator('.annual-value-row')).toHaveCount(1);
 await expect(history.locator('[data-year="2025"]')).toContainText('Recorded');
 await page.getByRole('button',{name:'View 2025 details'}).click();const dialog=page.getByRole('dialog');
 await dialog.locator('summary').filter({hasText:'Dated protest'}).click();
 await expect(dialog).toContainText('SYNTHETIC HISTORY AGENT');await expect(dialog).toContainText('May 8, 2025');
 await page.keyboard.press('Escape');
 await page.goto('/property/999121');
 await expect(page.locator('[data-year="2026"] td').nth(4)).toContainText('Unavailable');
 await expect(page.locator('[data-year="2026"]')).not.toContainText('Reduction only');
});

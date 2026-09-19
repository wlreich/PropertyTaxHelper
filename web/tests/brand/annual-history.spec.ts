import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('PAR-11 approved annual reference, chart values, alignment and accessible inline detail',async({page},info)=>{
  await page.goto('/property/736164');
  const history=page.getByRole('region',{name:'Your assessment over time'});
  const hero=await page.locator('.current-assessment').textContent();
  await expect(history.locator('.annual-value-row')).toHaveCount(2);
  const current=history.locator('[data-year="2026"]');
  const prior=history.locator('[data-year="2025"]');
  await expect(current).toContainText('$1,575,313'); await expect(current).toContainText('$1,377,354');
  await expect(current).toContainText('+$210,274 / 15.4%'); await expect(current).toContainText('Unchanged');
  await expect(prior.locator('td').nth(0)).toHaveText('Preliminary market$1,365,039');
  await expect(prior.locator('td').nth(2)).toContainText('Not available'); await expect(prior).toContainText('$1,252,140');
  await expect(prior.locator('td').nth(4)).toContainText('Unchanged');
  await expect(history.locator('.annual-chart-year')).toHaveCount(2);
  await expect(history.locator('.annual-chart')).toContainText('2025 certified Market value:');
  await expect(history.locator('.annual-chart')).toContainText('$1,365,039');
  await expect(history.locator('.annual-chart-axis span').first()).toHaveText('$0');
  await expect(history).toContainText('widened from $112,899 in 2025 to $197,959 in 2026');
  await expect(history.getByRole('button',{name:'Show earlier years'})).toHaveCount(0);
  for(const forbidden of ['Two years','View full record history','coming soon','2025 preliminary source']) await expect(history).not.toContainText(forbidden);
  await expect(history.locator('sup')).toHaveCount(0);
  if(info.project.use.viewport!.width===1440) {
    for(const cell of await current.locator('td').all()) await expect(cell).toHaveCSS('text-align','right');
    const cells=await current.locator('td').all(); const headers=await history.locator('thead th').all();
    for(let i=0;i<cells.length;i++) {
      const a=(await cells[i].boundingBox())!, b=(await headers[i+1].boundingBox())!;
      expect(Math.abs(a.x+a.width-b.x-b.width)).toBeLessThan(1);
    }
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await history.screenshot({path:info.outputPath('par11-history-collapsed.png')});
  await history.getByRole('button',{name:'Expand 2025 details'}).focus(); await page.keyboard.press('Enter');
  const detail=history.locator('#annual-details-2025');
  await expect(detail).toBeVisible(); await expect(detail).toContainText('May 8, 2025');
  await expect(detail).toContainText('2025 interim snapshot'); await expect(detail).toContainText('Jul 3, 2025');
  await expect(detail).toContainText('Jul 19, 2025'); await expect(detail).toContainText('Residence homestead');
  await expect(detail).toContainText('Home & improvements'); await expect(detail).toContainText('No protest found');
  expect(await page.locator('.current-assessment').textContent()).toBe(hero);
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  await history.screenshot({path:info.outputPath('par11-history-expanded.png')});
  await history.getByRole('button',{name:'Collapse 2025 details'}).focus(); await page.keyboard.press('Enter');
  await expect(detail).toBeHidden(); expect(await page.locator('.current-assessment').textContent()).toBe(hero);
  await page.evaluate(()=>{document.documentElement.style.zoom='2';});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('PAR-11 one, five and six years, earlier-year control and stable current story',async({page},info)=>{
  for(const [id,count,earlier] of [['999111',1,false],['999115',5,false],['999116',5,true]] as const) {
    await page.goto(`/property/${id}`); const history=page.locator('.annual-history');
    await expect(history.locator('.annual-value-row')).toHaveCount(count);
    await expect(history.locator('.annual-chart-year')).toHaveCount(count);
    await expect(history.getByRole('button',{name:'Show earlier years'})).toHaveCount(earlier?1:0);
    if(earlier) {
      const hero=await page.locator('.current-assessment').textContent();
      await history.getByRole('button',{name:'Show earlier years'}).focus(); await page.keyboard.press('Enter');
      await expect(history.locator('.annual-value-row')).toHaveCount(6); await expect(history.locator('.annual-chart-year')).toHaveCount(6);
      expect(await history.locator('.annual-value-row').evaluateAll(rows=>rows.map(row=>row.getAttribute('data-year')))).toEqual(['2026','2025','2024','2023','2022','2021']);
      await history.getByRole('button',{name:'Expand 2021 details'}).click();
      await expect(history.locator('#annual-details-2021')).toContainText('Apr 2, 2021');
      await history.getByRole('button',{name:'Collapse 2021 details'}).click();
      expect(await page.locator('.current-assessment').textContent()).toBe(hero);
      await history.screenshot({path:info.outputPath('par11-six-years.png')});
      await history.getByRole('button',{name:'Show latest five years'}).click();
      await expect(history.locator('.annual-value-row')).toHaveCount(5);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
});

test('PAR-11 missing history, nonconsecutive years, preliminary-only year and excluded baseline',async({page})=>{
  await page.goto('/property/999110'); await expect(page.locator('.annual-history')).toContainText('No annual assessment records');
  await expect(page.locator('.annual-table')).toHaveCount(0);
  await page.goto('/property/999117');
  await expect(page.locator('[data-year="2026"] td').nth(2)).toContainText('Not available');
  await page.goto('/property/999118');
  const future=page.locator('[data-year="2027"]'); await expect(future).toContainText('Preliminary only');
  await expect(future.locator('td').nth(0)).toContainText('$685,000');
  for(const i of [1,2,4]) await expect(future.locator('td').nth(i)).toContainText('Not available');
  await expect(page.locator('[data-chart-year="2027"]')).toHaveCount(0);
  await expect(page.locator('[data-chart-year="2026"]')).toHaveCount(1);
  await page.goto('/property/999119');
  const row=page.locator('[data-year="2025"]');
  await expect(row.locator('td').nth(0)).toContainText('Not available');
  await expect(row.locator('td').nth(4)).toContainText('Not available');
  await page.getByRole('button',{name:'Expand 2025 details'}).click();
  await expect(page.locator('#annual-details-2025')).toContainText('$1,365,039');
  await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

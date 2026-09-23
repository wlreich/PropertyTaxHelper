import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('market factors, matched median, unavailable preliminary baseline and sources',async({page},info)=>{
 await page.goto('/property/100');
 const panel=page.locator('#market-adjustment');
 // This old combined fixture deliberately reports TEST01 while the validated
 // adjustment belongs to T2450. Never attach another neighborhood's factor.
 await expect(panel).toContainText('Estimated effect: Not available');
 await expect(panel).not.toContainText('+$112,000');
 await page.goto('/property/736164');
 await expect(panel).toContainText('+$214,054');
 await expect(panel).toContainText('↑ $210,274 vs. 2025');
 await expect(panel).toContainText('1.46× → 1.78×');
 await page.getByRole('navigation',{name:'Property sections'}).getByRole('link',{name:'Value drivers',exact:true}).click();
 await expect(page).toHaveURL(/#market-adjustment-heading$/);
 await page.goto('/property/100/neighborhood');
 await expect(panel).toContainText('Estimated median effect');
 await expect(panel).toContainText('2 matched homes');
 await panel.getByText('How the estimate works',{exact:true}).click();
 await expect(panel).toContainText('2 of 5 included homes');
 await expect(panel).toContainText('2 homes: preliminary record unavailable');
 await expect(panel.getByRole('link',{name:'Appraisal District schedule, page 26'})).toHaveAttribute('href','/data/tcad/2026_Market_Adjustments.pdf#page=26');
 for(const name of ['2025_Market_Adjustments.pdf','2026_Market_Adjustments.pdf','2026_Residential_Valuation_Manual.pdf']){
  const response=await page.request.get(`/data/tcad/${name}`);
  expect(response.ok()).toBe(true);expect(response.headers()['content-type']).toContain('application/pdf');
  expect((await response.body()).subarray(0,5).toString()).toBe('%PDF-');
 }
 await expect(panel.getByRole('link',{name:'2026 Mass Appraisal Report, page 12'})).toHaveAttribute('href','https://traviscad.org/wp-content/uploads/2026_Mass-Appraisal-Report.pdf#page=12');
 expect((await new AxeBuilder({page}).include('#market-adjustment').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
 await panel.screenshot({path:info.outputPath('market-adjustment.png')});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('market factors, matched median, unavailable preliminary baseline and sources',async({page},info)=>{
 await page.goto('/property/100');
 const panel=page.locator('#market-adjustment');
 await expect(panel).toContainText('+$112,000');
 await expect(panel).toContainText('Original preliminary improvement values');
 await expect(panel).toContainText('1.46× → 1.78×');
 await page.getByRole('navigation',{name:'Property sections'}).getByRole('link',{name:'Value drivers',exact:true}).click();
 await expect(page).toHaveURL(/#market-adjustment-heading$/);
 await page.goto('/property/100/neighborhood');
 await expect(panel).toContainText('Median estimated effect across matched homes');
 await expect(panel).toContainText('2 of 5 included homes');
 await panel.getByText('How this estimate works and what is covered',{exact:true}).click();
 await expect(panel).toContainText('2 homes: preliminary snapshot unavailable');
 await expect(panel.getByRole('link',{name:'2026 schedule, p. 26'})).toHaveAttribute('href','/data/tcad/2026_Market_Adjustments.pdf#page=26');
 for(const name of ['2025_Market_Adjustments.pdf','2026_Market_Adjustments.pdf','2026_Residential_Valuation_Manual.pdf']){
  const response=await page.request.get(`/data/tcad/${name}`);
  expect(response.ok()).toBe(true);expect(response.headers()['content-type']).toContain('application/pdf');
  expect((await response.body()).subarray(0,5).toString()).toBe('%PDF-');
 }
 await expect(panel.getByRole('link',{name:'Appraisal District’s 2026 residential valuation manual, p. 8'})).toHaveAttribute('href','/data/tcad/2026_Residential_Valuation_Manual.pdf#page=8');
 await expect(panel).toContainText('2026_Market_Adjustments.pdf');
 expect((await new AxeBuilder({page}).include('#market-adjustment').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
 expect(await panel.locator('.market-adjustment-history').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
 await panel.screenshot({path:info.outputPath('market-adjustment.png')});
 await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.evaluate(()=>{document.documentElement.style.fontSize='';});
 await page.locator('#neighborhood-release').selectOption('22222222-2222-4222-8222-222222222222');
 await page.getByRole('button',{name:'View',exact:true}).click();
 await expect(panel).not.toContainText('1.78×');
 await expect(panel).toContainText('Both annual schedules are needed.');
});

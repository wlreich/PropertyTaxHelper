import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('market factors, matched median, unavailable preliminary baseline and sources',async({page},info)=>{
 await page.goto('/property/100');
 const panel=page.locator('#market-adjustment');
 // This old combined fixture deliberately reports TEST01 while the validated
 // adjustment belongs to T2450. Never attach another neighborhood's factor.
 await expect(panel).toContainText('Estimated effect: Not available');
 await expect(panel).not.toContainText('+$112,000');
 await expect(panel).not.toContainText('$0');
 await expect(panel).not.toContainText('preliminary snapshot');
 await page.goto('/property/736164');
 await expect(panel).toContainText('What changed in the 2026 preliminary appraisal?');
 await expect(panel).toContainText('A comparable preliminary record is not confirmed for both 2025 and 2026. Certified values are not substituted here.');
 await expect(panel).toContainText("Most homes don't sell each year. The Appraisal District compares its estimates with recent sales in your market area");
 await expect(panel).toContainText('+$214,054');
 await expect(panel).toContainText('Preliminary comparison unavailable');
 await expect(panel).not.toContainText('↑ $210,274 vs. 2025');
 await expect(panel).toContainText('1.46× → 1.78×');
 const propertyMethod=panel.locator('summary').filter({hasText:"See the multiplier's effect on this home."});
 await propertyMethod.click();
 await expect(propertyMethod.locator('..')).toHaveAttribute('open','');
 await expect(panel).toContainText('Using the same 2026 building inputs');
 await expect(panel).toContainText('The difference is an estimated +$214,054. Land is separate.');
 await expect(panel).toContainText('not the total change in your appraisal or tax savings');
 await expect(panel.locator('.factor-comparison')).toHaveAttribute('aria-label',/estimated factor effect is \+\$214,054/);
 await expect(panel).toContainText('first eligible preliminary record for 2026');
 await expect(panel).toContainText('reproduce the Appraisal District\'s recorded preliminary value of the home and other features within $1');
 await expect(panel).toContainText('Incomplete or unreconciled inputs are excluded rather than treated as zero.');
 await expect(panel).toContainText('Eligibility checked against preliminary records dated May 8, 2025 and Apr 2, 2026.');
 await expect(panel.getByRole('link',{name:'Read Data & methodology'})).toHaveAttribute('href','/methodology#market-adjustments');
 await propertyMethod.click();await expect(propertyMethod.locator('..')).not.toHaveAttribute('open','');
 await page.getByRole('navigation',{name:'Property sections'}).getByRole('link',{name:'Value drivers',exact:true}).click();
 await expect(page).toHaveURL(/#market-adjustment-heading$/);
 await page.goto('/property/999283');
 await expect(panel.getByRole('heading',{name:'Why did your 2026 preliminary appraisal change from last year?'})).toBeVisible();
 await expect(panel).toContainText('2026 preliminary compared with 2025 preliminary.');
 await expect(panel).toContainText('Land stayed the same. The preliminary value of your home and other features rose by $200,000 from last year.');
 await expect(panel).toContainText('$1,000,000');
 await expect(panel).toContainText('↑ $200,000 vs. 2025');
 await expect(panel).not.toContainText('$750,000');
 await expect(panel).toContainText('1.5× → 1.8×');
 await expect(panel).toContainText('+$120,000');
 await panel.locator('summary').filter({hasText:"See the multiplier's effect on this home."}).click();
 await expect(panel.locator('.factor-comparison-row').nth(0)).toContainText('With 2025 factor');
 await expect(panel.locator('.factor-comparison-row').nth(1)).toContainText('With 2026 factor');
 await expect(panel.locator('.factor-bar-difference')).toHaveCount(1);
 await page.goto('/property/100/neighborhood');
 await expect(panel).toContainText('The district estimates the cost of rebuilding each home and features such as garages and pools');
 await expect(panel).toContainText('The Appraisal District applies the factor to its estimated rebuilding cost after accounting for age and condition.');
 await expect(panel).toContainText('Estimated median effect');
 await expect(panel).toContainText('2 matched homes');
 await expect(panel).toContainText('The 2026 estimates change only the multiplier from 2025 1.46× to 2026 1.78×');
 await expect(panel).toContainText('These estimates isolate the factor’s contribution; they are not necessarily the total annual change, a whole-neighborhood total or tax savings.');
 const neighborhoodMethod=panel.locator('summary').filter({hasText:'How the estimate works'});
 await neighborhoodMethod.click();
 await expect(neighborhoodMethod.locator('..')).toHaveAttribute('open','');
 await expect(panel).toContainText('2 of 5 included homes');
 await expect(panel).toContainText('2 homes: preliminary record unavailable');
 await expect(panel).toContainText('first eligible preliminary record for 2026');
 await expect(panel).toContainText('Incomplete or unreconciled inputs are excluded rather than treated as zero.');
 await expect(panel.getByRole('link',{name:'Appraisal District schedule, page 26'})).toHaveAttribute('href','/data/tcad/2026_Market_Adjustments.pdf#page=26');
 await expect(panel.getByRole('link',{name:'read Data & methodology'})).toHaveAttribute('href','/methodology#market-adjustments');
 for(const name of ['2025_Market_Adjustments.pdf','2026_Market_Adjustments.pdf','2026_Residential_Valuation_Manual.pdf']){
  const response=await page.request.get(`/data/tcad/${name}`);
  expect(response.ok()).toBe(true);expect(response.headers()['content-type']).toContain('application/pdf');
  expect((await response.body()).subarray(0,5).toString()).toBe('%PDF-');
 }
 await expect(panel.getByRole('link',{name:'2026 Mass Appraisal Report, page 12'})).toHaveAttribute('href','https://traviscad.org/wp-content/uploads/2026_Mass-Appraisal-Report.pdf#page=12');
 await expect(panel).not.toContainText('preliminary snapshot');
 expect((await new AxeBuilder({page}).include('#market-adjustment').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
 await panel.screenshot({path:info.outputPath('market-adjustment.png')});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('PAR-48 disclosures reflow and remain keyboard accessible at focused widths',async({page},info)=>{
 test.skip(info.project.name!=='width-1440','Runs the focused 390/1440 matrix once.');
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});
  for(const [route,name] of [['/property/736164','property'],['/property/100/neighborhood','neighborhood']] as const){
   await page.goto(route);
   const panel=page.locator('#market-adjustment');
   const summary=panel.locator('summary').filter({hasText:name==='property'?"See the multiplier's effect on this home.":'How the estimate works'});
   await summary.click();await expect(summary.locator('..')).toHaveAttribute('open','');
   await summary.click();await expect(summary.locator('..')).not.toHaveAttribute('open','');
   const disclosureKey='Enter';
   await summary.focus();await page.keyboard.press(disclosureKey);
   await expect(summary.locator('..')).toHaveAttribute('open','');
   await expect(panel.getByRole('link',{name:/Data & methodology/i})).toHaveAttribute('href','/methodology#market-adjustments');
   expect((await new AxeBuilder({page}).include('#market-adjustment').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   const path=info.outputPath(`par48-${name}-${width}.png`);await panel.screenshot({path});await info.attach(`PAR-48 ${name} ${width}`,{path,contentType:'image/png'});
   await summary.focus();await page.keyboard.press(disclosureKey);await expect(summary.locator('..')).not.toHaveAttribute('open','');
  }
 }
 await page.setViewportSize({width:390,height:1000});await page.goto('/property/100/neighborhood');
 await page.locator('#market-adjustment summary').filter({hasText:'How the estimate works'}).click();
 await page.evaluate(()=>{document.documentElement.style.zoom='2';});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath('par48-neighborhood-390-200-percent.png'),fullPage:true});
});

test('PAR-52 supported and unavailable Value drivers reflow at 390 and 1440 px',async({page},info)=>{
 test.skip(info.project.name!=='width-1440','Runs the focused 390/1440 matrix once.');
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});
  for(const [id,state] of [['999283','supported'],['100','unavailable']] as const){
   await page.goto(`/property/${id}?par52-view=${width}`);
   const panel=page.locator('#market-adjustment');
   const summary=panel.locator('summary').filter({hasText:"See the multiplier's effect on this home."});
   const disclosure=summary.locator('..');
   await summary.click();await expect(disclosure).toHaveAttribute('open','');
   if(state==='supported'){
    await expect(panel.locator('.factor-comparison')).toBeVisible();
    await expect(panel.locator('.factor-comparison')).toHaveAttribute('aria-label',/same 2026 building inputs/i);
   } else await expect(panel.locator('.factor-comparison')).toHaveCount(0);
   expect((await new AxeBuilder({page}).include('#market-adjustment').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   const path=info.outputPath(`par52-${state}-${width}.png`);await panel.screenshot({path});await info.attach(`PAR-52 ${state} ${width}`,{path,contentType:'image/png'});
   await summary.click();await expect(disclosure).not.toHaveAttribute('open','');
  }
 }
 await page.setViewportSize({width:390,height:1000});await page.goto('/property/999283?par52-keyboard=1');
 const keyboardSummary=page.locator('#market-adjustment summary').filter({hasText:"See the multiplier's effect on this home."});
 const keyboardDisclosure=keyboardSummary.locator('..');
 await keyboardSummary.click();await expect(keyboardDisclosure).toHaveAttribute('open','');
 await keyboardSummary.click();await expect(keyboardDisclosure).not.toHaveAttribute('open','');
 await keyboardSummary.focus();await page.keyboard.press('Enter');await expect(keyboardDisclosure).toHaveAttribute('open','');
 await keyboardSummary.focus();await page.keyboard.press('Enter');await expect(keyboardDisclosure).not.toHaveAttribute('open','');
});

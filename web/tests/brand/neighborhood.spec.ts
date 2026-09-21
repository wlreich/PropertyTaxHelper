import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('neighborhood annual story, controls, canonical links and print parity',async({page},info)=>{
 test.skip(info.project.name!=='width-1440','One complete journey; responsive checks below cover other widths.');
 await page.goto('/property/100/neighborhood');
 await expect(page.getByRole('heading',{name:'Your neighborhood, in context.',exact:true})).toBeVisible();
 await expect(page.getByRole('navigation',{name:'Property tools'}).locator('[aria-current="page"]')).toHaveText('Neighborhood');
 await expect(page.locator('.activity-controls select')).toHaveCount(2);
 await expect(page.getByRole('form',{name:'Evidence research window'})).toBeVisible();
 await expect(page.getByRole('link',{name:'Print / save PDF',exact:true})).toHaveAttribute('href',/targetYear=2027&evidenceStart=2026-01-01&evidenceEnd=2026-12-31/);
 await expect(page.locator('.neighborhood-story')).toContainText('2026 certified');
 await expect(page.locator('.neighborhood-results')).toContainText('What changed during 2026');
 await expect(page.locator('.neighborhood-results')).toContainText('inferred from proposed-to-certified reductions');
 const sections=await page.locator('.neighborhood-analysis h2').allTextContents();
 expect(sections.indexOf('Where your home sits')).toBeLessThan(sections.indexOf('One driver of proposed values: the market-area multiplier'));
 expect(sections.indexOf('One driver of proposed values: the market-area multiplier')).toBeLessThan(sections.indexOf('Look across years, without changing views.'));
 const mode=page.getByRole('button',{name:'Value per sq. ft.',exact:true});await mode.focus();await page.keyboard.press('Enter');
 await expect(mode).toHaveAttribute('aria-pressed','true');await expect(mode).toHaveCSS('outline-style','solid');
 await expect(page.getByRole('img',{name:/Value per square foot distribution/})).toBeVisible();
 await expect(page.locator('.neighborhood-subject-value')).toContainText('$225 / sq ft');
 await page.getByRole('button',{name:'Market value',exact:true}).click();
 const disclosure=page.locator('summary').filter({hasText:'More annual outcomes and comparisons'});await disclosure.focus();await page.keyboard.press('Enter');
 await expect(disclosure).toHaveAttribute('aria-expanded','true');await expect(page.locator('.neighborhood-results').getByRole('table')).toBeVisible();await page.keyboard.press('Enter');await expect(disclosure).toHaveAttribute('aria-expanded','false');
 const compare=page.getByRole('link',{name:'Compare similar homes',exact:true});await expect(compare).toHaveAttribute('href',/\/property\/100\/compare\?release=/);
 await expect(page.getByRole('link',{name:'Read the protest guide →'})).toHaveAttribute('href','/protest-guide?property=100');
 await expect(page.getByRole('link',{name:'Support this project →'})).toHaveAttribute('href','https://donate.stripe.com/6oUaEP7jn6l39fSgXg7AI00');
 await page.getByRole('link',{name:'View your home’s market value and cap →'}).click();await expect(page.locator('#exemptions-heading')).toBeVisible();
 await page.goBack();await compare.click();await expect(page).toHaveURL(/\/property\/100\/compare\?release=/);await expect(page.getByRole('navigation',{name:'Property tools'}).locator('[aria-current="page"]')).toHaveText('Compare properties');await page.goBack();
 await page.getByRole('link',{name:'Read the protest guide →'}).click();await expect(page).toHaveURL(/protest-guide\?property=100/);await page.goBack();
 expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
 const story=await page.locator('.neighborhood-story').innerText();const results=await page.locator('.neighborhood-result-rows').innerText();
 await page.getByRole('link',{name:'Print / save PDF',exact:true}).click();await expect(page).toHaveURL(/\/neighborhood\/print$/);
 await expect(page.locator('.neighborhood-story')).toHaveText(story,{useInnerText:true});await expect(page.locator('.neighborhood-result-rows')).toHaveText(results,{useInnerText:true});
 await page.evaluate(()=>{window.print=()=>{document.body.dataset.printRequested='yes';};});await page.getByRole('button',{name:'Print or save as PDF'}).click();await expect(page.locator('body')).toHaveAttribute('data-print-requested','yes');
 await page.emulateMedia({media:'print'});await expect(page.locator('.print-toolbar')).toBeHidden();
 await page.goto('/property/9200/neighborhood/print');await expect(page.locator('.neighborhood-carry')).toBeVisible();await page.evaluate(()=>document.fonts.ready);const pdf=info.outputPath('neighborhood-report.pdf');await page.pdf({path:pdf,preferCSSPageSize:true,printBackground:true});await info.attach('Neighborhood print',{path:pdf,contentType:'application/pdf'});
 await page.emulateMedia({media:'screen'});await page.getByRole('link',{name:'Back to neighborhood analysis'}).click();await expect(page).toHaveURL(/\/property\/9200\/neighborhood\?targetYear=2027&evidenceStart=2026-01-01&evidenceEnd=2026-12-31$/);
 await page.goto('/property/103/neighborhood');await expect(page.getByRole('heading',{name:'Let’s try another address'})).toBeVisible();
});
test('neighborhood period labels, additional history and missing or small samples',async({page},info)=>{
 test.skip(info.project.name!=='width-1440','Compact state checks at one viewport.');
 await page.goto('/property/9201/neighborhood');await expect(page.locator('.neighborhood-story')).toContainText('2026 preliminary');await expect(page.locator('.neighborhood-results')).toContainText('What changed during 2025');await expect(page.locator('.neighborhood-history')).toContainText('reduced by at least 10% in 2025');
 await page.goto('/property/9202/neighborhood');const more=page.locator('summary').filter({hasText:'More available year pairs'});await more.click();await expect(page.getByRole('heading',{name:'Proposed values: 2024 → 2025'})).toBeVisible();
 await page.goto('/property/9203/neighborhood');await expect(page.locator('.neighborhood-carry .neighborhood-big')).toHaveText('3 of 3 homes back at or above the prior proposal');
 await page.goto('/property/9205/neighborhood');await expect(page.locator('.neighborhood-carry .neighborhood-big')).toHaveText('Not available');await expect(page.locator('.neighborhood-carry')).toContainText('No homes with a qualifying reduction');
 await page.goto('/property/9204/neighborhood');await expect(page.locator('.neighborhood-story')).toContainText('Not available');await expect(page.locator('.neighborhood-results')).toContainText('Missing results are not zero reductions');await expect(page.locator('.neighborhood-page')).not.toContainText(/NaN|Infinity|96\.5%|at least 5%/);await expect(page.locator('.neighborhood-story .neighborhood-metrics')).not.toContainText('$0');
});
test('neighborhood responsive layout and zoom',async({page},info)=>{
 await page.goto('/property/9200/neighborhood');await expect(page.locator('.neighborhood-carry')).toBeVisible();await expect(page.locator('.neighborhood-carry')).toContainText('at least 10%');await page.evaluate(()=>document.fonts.ready);
 const width=info.project.use.viewport!.width;
 if(width===1440||width===375){if(width===375)await page.setViewportSize({width:390,height:1000});const path=info.outputPath(width===1440?'neighborhood-desktop.png':'neighborhood-mobile.png');await page.screenshot({path,fullPage:true});await info.attach('Neighborhood layout',{path,contentType:'image/png'});}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 if(width===375){await page.setViewportSize({width:320,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 if(width===1440){await page.evaluate(()=>{document.documentElement.style.zoom='2';});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
});

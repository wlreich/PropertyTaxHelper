import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('PAR-10 reference sections: authority arithmetic, dynamic features, accessible disclosures and Figma captures', async ({page}, info) => {
  await page.goto('/property/736164');
  const cap = page.locator('.cap-section');
  await expect(cap).toContainText('Your starting point for next year');
  const calculation = cap.locator('.cap-calculation');
  for (const value of ['$1,575,313','− $197,959','$1,377,354','− $203,000','$1,174,354']) await expect(calculation).toContainText(value);
  await expect(cap.getByRole('link',{name:'Why review every year?'})).toHaveAttribute('href','/protest-guide?property=736164#annual-review');
  await expect(cap).toContainText('$956,614');
  await page.getByLabel('Calculation authority').selectOption('03');
  await expect(calculation).toContainText('Travis County exemptions');
  await expect(calculation).toContainText('− $420,740');
  await expect(calculation).toContainText('$956,614');
  await expect(calculation).not.toContainText('$203,000');
  await page.getByLabel('Calculation authority').selectOption('69');
  const drivers=page.locator('#market-adjustment');
  for(const value of ['$384,639','$1,190,674','↑ $210,274 vs. 2025','1.46× → 1.78×','+$214,054']) await expect(drivers).toContainText(value);
  const facts=page.locator('#property-details');
  for(const value of ['3 full + 1 half','1,121 sq ft','2012','R3','T2450','$42,809','$13,261']) await expect(facts).toContainText(value);
  await expect(facts.getByRole('link',{name:'Check the full property record',exact:false})).toHaveAttribute('href','https://travis.prodigycad.com/property-detail/736164/2026');
  for(const name of ['View exemption details','How the estimate works','View all separately valued features (12)','About construction class and neighborhood']) {
    const disclosure=page.locator('summary').filter({hasText:name});
    await disclosure.focus(); await page.keyboard.press('Enter');
    await expect(disclosure.locator('..')).toHaveAttribute('open','');
    if(name.startsWith('View all separately')) await expect(facts.locator('.property-feature-list')).toContainText('Fireplace');
    await page.keyboard.press('Enter'); await expect(disclosure.locator('..')).not.toHaveAttribute('open');
  }
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const guidanceCopy=await page.locator('.cap-guidance p').last().boundingBox();
  const guidanceAction=await cap.getByRole('link',{name:'Why review every year?'}).boundingBox();
  expect(guidanceAction!.y).toBeGreaterThanOrEqual(guidanceCopy!.y+guidanceCopy!.height);
  await page.evaluate(()=>{if(document.activeElement instanceof HTMLElement) document.activeElement.blur();});
  for(const [name,section] of [['cap',cap],['drivers',drivers],['details',facts]] as const) {
    const path=info.outputPath(`par10-${name}.png`); await section.screenshot({path}); await info.attach(`PAR-10 ${name}`,{path,contentType:'image/png'});
  }
  await page.evaluate(()=>{document.documentElement.style.zoom='2';});
  const zoomLayout=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,overflowing:Array.from(document.querySelectorAll('.property-section *')).filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>`${e.tagName}.${e.className}`).slice(0,15)}));
  expect(zoomLayout.scrollWidth,JSON.stringify(zoomLayout)).toBeLessThanOrEqual(zoomLayout.width);
});

test('PAR-10 conditional states do not promise an active cap or turn missing amounts into zero',async({page})=>{
  for(const [id,title] of [['999011','Your starting point for next year'],['999012','Keep reviewing your market value.'],['999013','More cap information needed.']]) {
    await page.goto(`/property/${id}`);
    await expect(page.locator('.cap-guidance h3')).toHaveText(title);
    if(id==='999011') await expect(page.locator('.cap-guidance')).toContainText('starting point for next year');
    if(id==='999012') await expect(page.locator('.cap-guidance')).toContainText('No residence homestead exemption');
    if(id==='999013') { await expect(page.locator('.cap-calculation')).toContainText('Not reported'); await expect(page.locator('.cap-calculation')).not.toContainText('$0'); await expect(page.locator('#property-details')).toContainText('Current feature records unavailable'); }
  }
});

test('PAR-10 large values and long feature and authority names reflow',async({page},info)=>{
  await page.goto('/property/999010');
  await expect(page.locator('.cap-calculation')).toContainText('$123,456,789');
  await page.locator('#property-details summary').filter({hasText:'View all separately valued features'}).click();
  await expect(page.locator('.property-feature-list')).toContainText('Detached Workshop');
  await expect(page.locator('.property-feature-list')).toContainText('$12,345,678');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('#property-details').screenshot({path:info.outputPath('par10-long-features.png')});
  await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

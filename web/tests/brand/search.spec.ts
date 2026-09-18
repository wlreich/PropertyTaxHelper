import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('brand, search, definitions and accessible responsive layout', async ({page}, info) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole('img',{name:'ParcelSavvy',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{level:1})).toHaveText('What happened to your property appraisal?');
  await expect(page.getByRole('heading',{name:'Your records become a story you can use.'})).toHaveCount(0);
  expect(await page.locator('#questions').evaluate(el=>el.previousElementSibling?.getAttribute('aria-label'))).toBe('Current assessment release');
  await expect(page.getByRole('heading',{name:'Useful property information shouldn’t disappear behind a paywall.'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Independent by design. Built for homeowners.'})).toBeVisible();
  await expect(page.locator('aside').getByRole('link',{name:'Support ParcelSavvy'})).toHaveAttribute('href','/support');
  await expect(page.getByText('Optional contributions are not charitable donations and are not tax-deductible.')).toBeVisible();
  await expect(page.getByRole('link',{name:'Privacy policy'})).toHaveAttribute('href','/privacy');
  expect(await page.locator('h1').evaluate(el=>getComputedStyle(el).fontFamily)).toMatch(/manrope/i);
  expect(await page.locator('body').evaluate(el=>getComputedStyle(el).fontFamily)).toMatch(/inter/i);
  await expect(page.getByRole('button',{name:'Search',exact:true})).toHaveCSS('background-color','rgb(23, 105, 170)');
  await expect(page.getByText('County Appraisal District: Travis Central Appraisal District (TCAD)',{exact:true})).toBeVisible();
  const example=page.getByRole('complementary',{name:'An example appraisal story'});
  await expect(example.getByText('Example only',{exact:true})).toBeVisible();
  await expect(example).toHaveAccessibleDescription('Fictional values to show what you can explore.');
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('home-page.png'),fullPage:true});
  await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});
  expect(await page.evaluate(()=>Array.from(document.querySelectorAll('body *')).filter(el=>el.getBoundingClientRect().right>innerWidth+1).map(el=>({tag:el.tagName,className:el.className})))).toEqual([]);
  await page.screenshot({path:info.outputPath('home-page-enlarged.png'),fullPage:true});
  await page.evaluate(()=>{document.documentElement.style.fontSize='';});
  await page.getByLabel('Property address or property ID').fill('Oak');
  await page.getByRole('button',{name:'Search',exact:true}).click();
  await expect(page.locator('.result-card')).toHaveCount(2);
  const term=page.getByRole('button',{name:'Market value',exact:true});
  await term.focus(); await expect(page.getByRole('tooltip')).toBeVisible();
  await term.press('Escape'); await expect(page.getByRole('tooltip')).toBeHidden();
  const issues=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(issues.violations).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const capture=info.outputPath('search-results.png');
  await page.screenshot({path:capture,fullPage:true});
  await info.attach('Responsive search results',{path:capture,contentType:'image/png'});
  if(process.env.BRAND_VISUAL_COMPARE==='1') await expect(page).toHaveScreenshot('search-results.png',{fullPage:true});
  await page.goto('/?q=Parkdemo');
  await expect(page.locator('.result-card')).toHaveCount(5);
  await expect(page.getByLabel('Show all parcels',{exact:true})).toHaveCount(0);
  await page.goto('/?q=Parkdemo&all=1');
  await expect(page.locator('.result-card')).toHaveCount(5);
  await expect(page.getByText('Parkland',{exact:true})).toHaveCount(0);
  await page.goto('/?q=NoSuchStreet');
  await expect(page.getByRole('heading',{name:'No matching addresses found'})).toBeVisible();
});

test('search support action stays readable and opens checkout information',async({page},info)=>{
  await page.goto('/');
  const support=page.locator('aside').getByRole('link',{name:'Support ParcelSavvy',exact:true});
  await expect(support).toBeVisible();
  await expect(support).toHaveCSS('color','rgb(255, 255, 255)');
  await expect(support).toHaveCSS('background-color','rgb(23, 105, 170)');
  await support.scrollIntoViewIfNeeded();
  expect((await new AxeBuilder({page}).include('#support').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  await support.hover();
  await expect(support).toHaveCSS('color','rgb(255, 255, 255)');
  await expect(support).toHaveCSS('background-color','rgb(11, 45, 77)');
  await support.focus();
  await expect(support).toBeFocused();
  await expect(support).toHaveCSS('outline-style','solid');
  await page.screenshot({path:info.outputPath('support-button.png')});
  await support.press('Enter');
  await expect(page).toHaveURL(/\/support$/);
  await expect(page.getByRole('link',{name:'Continue to secure checkout'})).toHaveAttribute('href','https://donate.stripe.com/6oUaEP7jn6l39fSgXg7AI00');
  await page.goBack();
  await expect(support).toHaveCSS('color','rgb(255, 255, 255)');
  await support.click();
  await expect(page).toHaveURL(/\/support$/);
});

test('launch information pages are complete, linked and accessible',async({page})=>{
  for(const [path,heading] of [
    ['/privacy','Privacy policy'],
    ['/terms','Terms of use'],
    ['/accessibility','Accessibility'],
    ['/contact','How can we help?'],
    ['/report-data-issue?property=100','Report a data issue'],
    ['/support','Help keep ParcelSavvy open'],
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading',{level:1,name:heading,exact:true})).toBeVisible();
    await expect(page.getByText('Systems & Sense LLC',{exact:false}).first()).toBeVisible();
    expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.goto('/report-data-issue?property=100');
  await expect(page.getByRole('link',{name:'Start a data-issue email'})).toHaveAttribute('href',/property\+100|property%20100/);
  await page.goto('/support');
  await expect(page.getByRole('link',{name:'Continue to secure checkout'})).toHaveAttribute('href','https://donate.stripe.com/6oUaEP7jn6l39fSgXg7AI00');
});

test('address variants and labeled spelling suggestions', async ({page}, info) => {
  await page.goto('/?q=1800+West+36th+Street');
  await expect(page.locator('.result-card').first()).toContainText('1800 W 36 ST');
  await expect(page.locator('.result-card')).toHaveCount(3);
  await page.getByLabel('Property address or property ID').fill('700 Paw Prnit Drive Apt 2');
  await page.getByRole('button',{name:'Search',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Possible matches',exact:true})).toBeVisible();
  await expect(page.locator('.result-card')).toHaveCount(1);
  await expect(page.locator('.result-card')).toContainText('700 PAW PRINT DR UNIT 2');
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  await page.locator('.result-card').focus();
  const capture=info.outputPath('possible-matches.png');
  await page.screenshot({path:capture,fullPage:true});
  await info.attach('Possible matches',{path:capture,contentType:'image/png'});
  await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});
  const overflowing = await page.evaluate(()=>Array.from(document.querySelectorAll('body *')).filter(el=>el.getBoundingClientRect().right>innerWidth+1).map(el=>({tag:el.tagName,className:el.className})));
  expect(overflowing).toEqual([]);
  const enlarged=info.outputPath('possible-matches-enlarged.png');
  await page.screenshot({path:enlarged,fullPage:true});
  await info.attach('Possible matches with enlarged text',{path:enlarged,contentType:'image/png'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('.result-card').press('Enter');
  await expect(page).toHaveURL(/property\/990010/);
});

test('typeahead narrows house-number matches and supports keyboard selection', async ({page}) => {
  await page.goto('/');
  const search=page.getByLabel('Property address or property ID');
  await search.fill('1104');
  const listbox=page.getByRole('listbox',{name:'Matching property addresses'});
  await expect(listbox).toBeVisible();
  await expect(listbox.getByRole('option')).toHaveCount(8);
  await expect(listbox.getByText('Keep typing to narrow the list, or search to see all matches.')).toBeVisible();
  await search.press('Escape');
  await expect(listbox).toBeHidden();
  await search.fill('1104 Cedar');
  await expect(listbox.getByRole('option')).toHaveCount(1);
  await expect(listbox.getByRole('option')).toContainText('1104 CEDAR ST');
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  await search.press('ArrowDown');
  await expect(listbox.getByRole('option')).toHaveAttribute('aria-selected','true');
  await search.press('Enter');
  await expect(page).toHaveURL(/property\/990016/);
});

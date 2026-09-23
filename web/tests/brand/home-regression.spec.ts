import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const fullAddresses = [
  '1104 Paw Print', '1104 Paw Print,', '1104 Paw Print Leander',
  '1104 Paw Print 78641', '1104 Paw Print Leander 78641',
  '1104 Paw Print, Leander, TX 78641', '1104 Paw Print Leander TX',
  '1104 Paw Print Leander Texas', '1104 Paw Print, Leander, Texas 78641', '736302',
];

test('PAR-5 full addresses, IDs, typo recovery, unit and street variants', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/');
  const search = page.getByRole('combobox');
  for (const q of fullAddresses) {
    await search.fill(q);
    await expect(page.getByRole('option')).toHaveCount(1);
    await expect(page.getByRole('option')).toContainText('736302');
    await search.press('Enter');
    await expect(page).toHaveURL(url => url.searchParams.get('q') === q);
    await expect(page.locator('.result-card')).toHaveCount(1);
    await expect(page.locator('.result-card')).toHaveAttribute('href', /\/property\/736302\?/);
  }
  for (const q of ['1104 Paw Print, Houston, TX 77001', '1104 Paw Print Leander TX 99999', '1104 Paw Print Leander CA 78641', '999999999', 'NoSuchStreet']) {
    await search.fill(q);
    await expect(page.getByRole('status')).toContainText('No matching properties found.');
    await expect(page.getByRole('option')).toHaveCount(0);
    await search.press('Enter');
    await expect(page).toHaveURL(url => url.searchParams.get('q') === q);
    await expect(page.getByRole('heading', { name: 'No matching properties found.', exact: true })).toBeVisible();
    if (q === '999999999') await expect(page.locator('.empty-state')).toContainText('Check the property ID or try a street address.');
    if (q === 'NoSuchStreet') await expect(page.locator('.empty-state')).toContainText('check the spelling');
  }
  await search.fill('1104 Paw Prnit');
  await search.press('Enter');
  await expect(page.getByRole('heading', { name: 'Possible matches', exact: true })).toBeVisible();
  await expect(page.locator('.result-card')).toHaveAttribute('href', /\/property\/736302\?/);
  for (const q of ['1905 West 36th Street Unit B', '1905 W 36 St #B']) {
    await search.fill(q);
    await search.press('Enter');
    await expect(page).toHaveURL(url => url.searchParams.get('q') === q);
    await expect(page.locator('.result-card')).toHaveCount(1);
    await expect(page.locator('.result-card')).toHaveAttribute('href', /\/property\/799047\?/);
  }
});

test('PAR-5 blank inputs do not request suggestions or navigate', async ({ page }) => {
  await page.goto('/');
  const requests: string[] = [];
  page.on('request', req => {
    const url = new URL(req.url());
    if (url.pathname === '/api/search/suggestions' || (url.pathname === '/' && url.searchParams.has('q'))) requests.push(req.url());
  });
  const search = page.getByRole('combobox');
  for (const q of ['', '   ']) {
    await search.fill(q);
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(search).toBeFocused();
    await expect(page.getByRole('alert').filter({ hasText: 'Enter an address or property ID.' })).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  }
  expect(requests).toEqual([]);
});

test('PAR-6 search links focus input; Back, Forward and clear preserve only the draft', async ({ page }) => {
  await page.goto('/');
  const search = page.getByRole('combobox');
  const searchLinks = ['Search my property ↑', 'Property search'];
  if (page.viewportSize()!.width > 700) searchLinks.push('Search');
  for (const name of searchLinks) {
    await page.getByRole('link', { name, exact: true }).press('Enter');
    await expect(search).toBeFocused();
    await page.keyboard.type('1102 Paw');
    await expect(search).toHaveValue('1102 Paw');
    await search.fill('');
  }
  for (const [q,id,keyboard] of [['1102 Paw','736303',true], ['1104 Paw','736302',false]] as const) {
    await search.fill(q);
    await expect(page.getByRole('option')).toHaveCount(1);
    if (keyboard) { await search.press('ArrowDown'); await search.press('Enter'); }
    else await page.getByRole('option').click();
    await expect(page).toHaveURL(new RegExp(`/property/${id}\\?`));
    await page.goBack();
    await expect(search).toHaveValue(q);
    await expect(search).toHaveAttribute('aria-expanded', 'false');
    await expect(search).not.toHaveAttribute('aria-activedescendant', /option/);
    await page.goForward();
    await expect(page).toHaveURL(new RegExp(`/property/${id}\\?`));
    await page.getByRole('link', { name: /Back to search results/ }).click();
    await expect(search).toHaveValue(q);
    await page.reload();
    await expect(search).toHaveValue(q);
    await page.goto('/');
  }
  await search.fill('1102 Paw');
  await search.fill('');
  await page.getByRole('link', { name: 'Data & methodology', exact: true }).click();
  await expect(page).toHaveURL(/\/methodology$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(search).toHaveValue('');
  await expect(search).toHaveAttribute('aria-expanded', 'false');
});

test('PAR-6 page two and in-app return retain query and page', async ({ page }) => {
  await page.goto('/?q=HomeFixture');
  await page.getByRole('link', { name: 'Next →', exact: true }).click();
  await expect(page).toHaveURL(/q=HomeFixture&page=1/);
  await page.locator('.result-card').first().click();
  await page.getByRole('link', { name: /Back to search results/ }).click();
  await expect(page).toHaveURL(/q=HomeFixture&page=1/);
  await expect(page.getByRole('combobox')).toHaveValue('HomeFixture');
  await page.reload();
  await expect(page.getByText('Page 2', { exact: true })).toBeVisible();
});

test('PAR-6 delayed superseded responses, clear, Escape, Tab and failures', async ({ page }) => {
  await page.goto('/');
  let releaseOld!: () => void;
  const oldGate = new Promise<void>(resolve => { releaseOld = resolve; });
  let oldStarted!: () => void;
  const started = new Promise<void>(resolve => { oldStarted = resolve; });
  await page.route('**/api/search/suggestions?**', async route => {
    const q = new URL(route.request().url()).searchParams.get('q');
    if (q === '1102 Paw') {
      oldStarted(); await oldGate;
      await route.fulfill({ json: { status: 'ok', items: [{ property_id:'736303', address:'1102 PAW PRINT', city:'', postal_code:'78641', is_parkland:false }], has_more:false } }).catch(() => {});
    } else if (q === 'Failure') await route.fulfill({status:503,json:{status:'unavailable'}});
    else await route.continue();
  });
  const search = page.getByRole('combobox');
  await search.fill('1102 Paw');
  await started;
  await search.fill('1104 Paw');
  await expect(page.getByRole('option')).toContainText('736302');
  releaseOld();
  await expect(page.getByRole('option')).not.toContainText('736303');
  await search.press('ArrowDown');
  await expect(page.getByRole('option')).toHaveAttribute('aria-selected','true');
  await search.press('Escape');
  await expect(page.getByRole('listbox')).toBeHidden();
  await search.press('ArrowUp');
  await expect(page.getByRole('option')).toHaveAttribute('aria-selected','true');
  await search.press('Tab');
  await expect(page.getByRole('button',{name:'Search',exact:true})).toBeFocused();
  await expect(page.getByRole('listbox')).toBeHidden();
  await search.fill('Failure');
  await expect(page.getByRole('status')).toContainText('Suggestions are temporarily unavailable');
  await search.fill('');
  await expect(search).toHaveAttribute('aria-expanded','false');
  await expect(page.getByRole('option')).toHaveCount(0);
});

test('PAR-6 clearing while a response is delayed cannot restore an old selection', async ({ page }) => {
  await page.goto('/');
  let release!: () => void;
  let started!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const ready = new Promise<void>(resolve => { started = resolve; });
  let finished!: () => void;
  const done = new Promise<void>(resolve => { finished = resolve; });
  await page.route('**/api/search/suggestions?**', async route => {
    started(); await gate;
    await route.fulfill({json:{status:'ok',items:[{property_id:'736303',address:'1102 PAW PRINT',city:'',postal_code:'78641',is_parkland:false}],has_more:false}}).catch(() => {});
    finished();
  });
  const search = page.getByRole('combobox');
  await search.fill('1102 Paw'); await ready;
  await search.fill(''); release(); await done;
  await expect(search).toHaveValue('');
  await expect(search).toHaveAttribute('aria-expanded','false');
  await expect(page.getByRole('option')).toHaveCount(0);
  await search.press('ArrowDown'); await search.press('Enter');
  await expect(page).toHaveURL(/\/$/);
  await expect(search).toBeFocused();
});

test('PAR-8 footer methodology destinations, content, Back and accessibility', async ({ page }, info) => {
  for (const path of ['/', '/?q=1104+Paw']) {
    await page.goto(path);
    await page.getByRole('link', { name: 'Data & methodology', exact: true }).press('Enter');
    await expect(page).toHaveURL(/\/methodology$/);
    await expect(page.getByRole('heading', { level:1, name:'Data & methodology' })).toBeVisible();
    for (const id of ['sources','values','comparisons','protests']) await expect(page.locator(`#${id}`)).toBeVisible();
    for (const heading of ['Sources and methodology','Where the data comes from','How we use it','What the data can and cannot tell you','Independent of the Appraisal District']) {
      await expect(page.getByRole('heading', { name:heading, exact:true })).toBeVisible();
    }
    for (const obsolete of ['Sources and dates','2026 values','2025 history','Supplemental protest evidence','source inventory checked']) {
      await expect(page.getByText(obsolete, { exact:false })).toHaveCount(0);
    }
    await expect(page.getByText(/Last updated/)).toHaveCount(0);
    await expect(page.getByRole('link',{name:'Review official property records',exact:true})).toHaveAttribute('href','https://traviscad.org/propertysearch/');
    await expect(page.getByRole('link',{name:'Report a data issue',exact:true}).first()).toHaveAttribute('href','/report-data-issue');
    expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath('methodology.png'),fullPage:true});
    await page.goBack();
    await expect(page).toHaveURL(path==='/' ? /\/$/ : /q=1104\+Paw/);
  }

  await page.goto('/contact');
  await page.getByRole('contentinfo').getByRole('link', { name:'Data & methodology', exact:true }).click();
  await expect(page).toHaveURL(/\/methodology$/);

  const officialRecords = page.getByRole('link', { name:'Review official property records', exact:true });
  const reportIssue = page.getByRole('link', { name:'Report a data issue', exact:true }).first();
  for (const width of [320,390,768,1440]) {
    await page.setViewportSize({ width, height:1000 });
    const cards = page.locator('#sources > div').first().locator(':scope > div');
    const [sourceCard, useCard] = await Promise.all([cards.nth(0).boundingBox(), cards.nth(1).boundingBox()]);
    expect(sourceCard).not.toBeNull();
    expect(useCard).not.toBeNull();
    if (width <= 390) expect(useCard!.y).toBeGreaterThan(sourceCard!.y + sourceCard!.height);
    else expect(Math.abs(useCard!.y - sourceCard!.y)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow at ${width}px`).toBe(true);
    if (width === 390 || width === 1440) await page.screenshot({path:info.outputPath(`methodology-${width}.png`),fullPage:true});
  }
  await page.setViewportSize({ width:390, height:1000 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  expect(await page.evaluate(() => Array.from(document.querySelectorAll('body *')).filter(element => element.getBoundingClientRect().right > innerWidth + 1).map(element => ({ tag:element.tagName, className:element.className, right:element.getBoundingClientRect().right }))), 'overflow at 200% zoom').toEqual([]);
  await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
  await officialRecords.focus();
  await expect(officialRecords).toBeFocused();
  await reportIssue.focus();
  await expect(reportIssue).toBeFocused();
});

test('PAR-7 text alignment, responsive footer, enlarged text and tooltip', async ({ page }, info) => {
  test.setTimeout(90_000);
  await page.goto('/?q=1104+Paw');
  await page.evaluate(() => document.fonts.ready);
  for (const width of [320,375,390,768,1024,1363,1440]) {
    await page.setViewportSize({width,height:936});
    const term = page.getByRole('button',{name:'Market value',exact:true});
    if (width >= 768) {
      const tops = await term.evaluate(button => {
        const header = button.closest('.definition')!.parentElement!;
        const textTop = (node:Node) => { const r = document.createRange(); r.selectNodeContents(node); return r.getBoundingClientRect().top; };
        return [textTop(header.firstElementChild!.firstChild!),textTop(button.firstChild!)];
      });
      expect(Math.abs(tops[0]-tops[1])).toBeLessThanOrEqual(1);
      await term.hover(); await expect(page.getByRole('tooltip')).toBeVisible();
      await term.focus(); await term.press('Escape'); await expect(page.getByRole('tooltip')).toBeHidden();
    }
    const footerLink = page.getByRole('link',{name:'Official Appraisal District search ↗',exact:true});
    const lastWord = await footerLink.locator('span').evaluate(el=>{
      const r = document.createRange(); r.selectNodeContents(el); return Array.from(r.getClientRects()).map(x=>x.top);
    });
    expect(new Set(lastWord).size).toBe(1);
    expect(await page.evaluate(()=>Array.from(document.querySelectorAll('body *')).filter(el=>el.getBoundingClientRect().right>innerWidth+1).map(el=>({tag:el.tagName,class:el.className,right:el.getBoundingClientRect().right}))), `overflow at ${width}px`).toEqual([]);
    await page.screenshot({path:info.outputPath(`results-${width}.png`),fullPage:true});
    await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});
    expect(await page.evaluate(()=>Array.from(document.querySelectorAll('body *')).filter(el=>el.getBoundingClientRect().right>innerWidth+1).map(el=>({tag:el.tagName,class:el.className,right:el.getBoundingClientRect().right}))), `overflow at ${width}px`).toEqual([]);
    await page.screenshot({path:info.outputPath(`enlarged-${width}.png`),fullPage:true});
    await page.evaluate(()=>{document.documentElement.style.fontSize='';});
  }
});


test('initial pageshow cannot clear suggestions for a query already being typed', async ({page}) => {
  await page.goto('/');
  const search=page.getByRole('combobox');
  await search.fill('1104 Paw Print');
  await expect(page.getByRole('option')).toHaveCount(1);
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow', {persisted:false})));
  await expect(search).toHaveValue('1104 Paw Print');
  await expect(page.getByRole('option')).toHaveCount(1);
});

test('PAR-37 street-first discovery filters vacant lots and preserves residential keyboard selection', async ({page})=>{
 await page.goto('/');
 const search=page.getByRole('combobox');
 await search.fill('high lonesome');
 await expect(page.getByRole('option')).toHaveCount(2);
 await expect(page.getByRole('listbox')).not.toContainText('736081');
 await expect(page.getByRole('listbox')).toContainText('736083');
 await expect(page.getByRole('listbox')).toContainText('736086');
 await search.press('ArrowDown');await search.press('ArrowDown');await search.press('Enter');
 await expect(page).toHaveURL(/\/property\/736086\?/);
 await expect(page.getByRole('heading',{level:1})).toHaveText('1402 HIGH LONESOME');
 await page.goto('/?q=high+lonesome');
 await expect(page.locator('.result-card')).toHaveCount(2);
 await expect(page.locator('.result-card').filter({hasText:'ID 736081'})).toHaveCount(0);
 await page.goto('/?q=736081');
 await expect(page.locator('.result-card')).toHaveAttribute('href',/\/property\/736081\?/);
});

test('street-first numbered suggestions normalize direction and ordinal variants',async({page})=>{
 await page.goto('/');
 const search=page.getByLabel('Property address or property ID');
 for(const query of ['west 36','w 36th']) {
  await search.fill(query);
  const listbox=page.getByRole('listbox',{name:'Matching property addresses'});
  await expect(listbox).toBeVisible();
  await expect(listbox.getByRole('option').filter({hasText:'1800 W 36 ST'})).toHaveCount(1);
  await expect(listbox).not.toContainText('1800 E 36 ST');
  await expect(listbox).not.toContainText('1800 W 37 ST');
  await expect(listbox).not.toContainText('1800 W 136 ST');
 }
});

import { test, expect, type Page, type Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { protestGuide } from '../../src/content/protest-guide';

const annualReview = protestGuide.chapters.find(chapter => chapter.number === '02')!;
const subject = '/property/736164';

async function openMenu(page: Page) {
  const nav = page.locator('header').getByRole('navigation');
  const menu = nav.locator('summary');
  if (await menu.isVisible()) {
    await menu.focus();
    await menu.press('Enter');
  }
  return nav;
}

async function keyboardLink(link: Locator) {
  await link.focus();
  // A previous mouse click leaves programmatic focus in pointer modality.
  // Enter via actual sequential keyboard navigation before checking :focus-visible.
  await link.press('Tab');
  await link.page().keyboard.press('Shift+Tab');
  await expect(link).toBeFocused();
  expect(await link.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
  expect(await link.evaluate(el => parseFloat(getComputedStyle(el).outlineWidth))).toBeGreaterThan(0);
  await link.press('Enter');
}

async function noOverflow(page: Page) {
  const geometry = await page.evaluate(() => ({width:innerWidth, scroll:document.documentElement.scrollWidth,
    overflowing:Array.from(document.querySelectorAll('body *')).filter(el => el.getBoundingClientRect().right > innerWidth + 1).map(el => ({tag:el.tagName,class:el.className,right:el.getBoundingClientRect().right})).slice(0,20)}));
  expect(geometry.scroll, JSON.stringify(geometry)).toBeLessThanOrEqual(geometry.width + 1);
}

test('PAR-17 header and education card preserve a submitted search through guide and Back', async ({page}) => {
  test.skip(page.viewportSize()!.width === 768, 'Journey covered at mobile and desktop; tablet uses layout assertions.');
  await page.goto('/');
  const nav = await openMenu(page);
  const guide = nav.getByRole('link', {name:'Protest Guide', exact:true});
  await expect(guide).toHaveCount(1);
  await expect(guide).toHaveAttribute('href','/protest-guide');
  await expect(guide).not.toHaveAttribute('target');
  await keyboardLink(guide);
  await expect(page).toHaveURL(/\/protest-guide$/);
  await expect(page.getByRole('heading', {name:'Your appraisal deserves a second look.'})).toBeVisible();
  await page.goBack();
  const search = page.getByRole('combobox');
  await search.fill('1104 Paw');
  await search.press('Enter');
  await expect(page).toHaveURL(/q=1104\+Paw/);
  const result = page.locator('.result-card');
  await expect(result).toHaveCount(1);
  const resultHref = await result.getAttribute('href');
  const card = page.getByRole('region', {name:'Thinking about protesting?'});
  await expect(card).toContainText('Understand your assessment, explore working with an agent or doing it yourself, and learn how to prepare.');
  expect((await card.boundingBox())!.y).toBeGreaterThan((await page.locator('.results-section').boundingBox())!.y);
  const read = card.getByRole('link', {name:'Read the guide.',exact:true});
  await expect(read).toHaveAttribute('href','/protest-guide');
  await expect(read).not.toHaveAttribute('target');
  const submissions: string[] = [];
  page.on('request', req => { const u=new URL(req.url()); if (u.pathname==='/' && u.searchParams.has('q')) submissions.push(u.href); });
  await keyboardLink(read);
  await expect(page).toHaveURL(/\/protest-guide$/);
  expect(submissions).toEqual([]);
  await page.goBack();
  await expect(page).toHaveURL(/q=1104\+Paw/);
  await expect(search).toHaveValue('1104 Paw');
  await expect(result).toHaveAttribute('href',resultHref!);
  await expect(page.getByRole('link',{name:'Download printable PDF'})).toHaveCount(0);
});

test('PAR-18 property landing and annual-review chapter preserve subject, return link and history', async ({page}) => {
  test.skip(page.viewportSize()!.width === 768, 'Journey covered at mobile and desktop; tablet uses layout assertions.');
  await page.goto(subject);
  const nav = page.getByRole('navigation',{name:'Property tools'});
  await expect(nav.getByRole('link',{name:'Overview',exact:true})).toHaveAttribute('aria-current','page');
  const guide = nav.getByRole('link',{name:'Protest Guide',exact:true});
  await expect(guide).toHaveCount(1);
  await expect(guide).toHaveAttribute('href','/protest-guide?property=736164');
  await keyboardLink(guide);
  await expect(page).toHaveURL(/\/protest-guide\?property=736164$/);
  const back = page.getByRole('link',{name:'← Back to property overview'});
  await expect(back).toHaveAttribute('href',subject);
  await back.click();
  await expect(page).toHaveURL(new RegExp(`${subject}$`));
  const cap = page.locator('.cap-guidance');
  await expect(page.locator('.overview-context').getByRole('link',{name:'Compare similar properties'})).toHaveAttribute('href',`${subject}/compare`);
  await expect(page.locator('.overview-context').getByRole('link',{name:'Compare similar properties'})).toHaveClass('action-button');
  const review = cap.getByRole('link',{name:'Why review every year?'});
  await expect(review).toHaveAttribute('href',`/protest-guide?property=736164#${annualReview.anchor}`);
  await keyboardLink(review);
  const heading = page.locator(`#${annualReview.anchor}-toggle`);
  async function chapterVisible() {
    await expect(page).toHaveURL(new RegExp(`property=736164#${annualReview.anchor}$`));
    await expect(heading).toHaveAttribute('aria-expanded','true');
    await expect(heading).toBeInViewport();
    const header = page.locator('header');
    const sticky = await header.evaluate(el => getComputedStyle(el).position === 'sticky');
    expect((await heading.boundingBox())!.y).toBeGreaterThanOrEqual(sticky ? (await header.boundingBox())!.height : 0);
    for (const section of annualReview.sections) await expect(page.locator(`#${section.id}`)).toBeVisible();
    await expect(back).toHaveAttribute('href',subject);
  }
  await chapterVisible();
  await page.reload();
  await chapterVisible();
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`${subject}$`));
  await page.goForward();
  await chapterVisible();
});

test('PAR-18 no-homestead fixture keeps neutral annual guidance and correct comparison subject', async ({page}) => {
  test.skip(page.viewportSize()!.width !== 1440, 'One deterministic conditional-state check is sufficient.');
  await page.goto('/property/999012');
  const cap = page.locator('.cap-guidance');
  await expect(cap).toContainText('A homestead cap has not been established here.');
  await expect(cap).not.toContainText('Your cap helps.');
  await expect(cap).not.toContainText('Your cap limits growth');
  await expect(page.locator('.overview-context').getByRole('link',{name:'Compare similar properties'})).toHaveAttribute('href','/property/999012/compare');
  await expect(cap.getByRole('link',{name:'Why review every year?'})).toHaveAttribute('href',`/protest-guide?property=999012#${annualReview.anchor}`);
  await expect(page.getByRole('link',{name:'Download printable PDF'})).toHaveCount(0);
});

test('PAR-17/18 focused layout, accessibility and screenshots at required widths', async ({page},info) => {
  test.skip(page.viewportSize()!.width !== 1440, 'One width loop, not a functional scenario matrix.');
  test.setTimeout(90_000);
  for (const width of [320,390,768,1440]) {
    await page.setViewportSize({width,height:1000});
    await page.goto('/');
    const nav = await openMenu(page);
    await expect(nav.getByRole('link',{name:'Protest Guide',exact:true})).toHaveCount(1);
    await noOverflow(page);
    const card = page.getByRole('region',{name:'Thinking about protesting?'});
    for (const link of [nav.getByRole('link',{name:'Protest Guide',exact:true}),card.getByRole('link')]) {
      const box=(await link.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x+box.width).toBeLessThanOrEqual(width+1);
    }
    if (width===390 || width===1440) {
      expect((await new AxeBuilder({page}).include('header').include('[aria-labelledby="guide-discovery-heading"]').analyze()).violations).toEqual([]);
      await page.locator('header').screenshot({path:info.outputPath(`home-navigation-${width}.png`)});
      await card.screenshot({path:info.outputPath(`home-guide-card-${width}.png`)});
    }
    if (width===390) {
      await page.evaluate(()=>{document.documentElement.style.zoom='2';});
      await noOverflow(page);
      await page.evaluate(()=>{document.documentElement.style.zoom='';});
    }
    await page.goto(subject);
    const propertyNav=page.getByRole('navigation',{name:'Property tools'});
    await expect(propertyNav.getByRole('link',{name:'Protest Guide',exact:true})).toHaveCount(1);
    const cap=page.locator('.cap-guidance');
    const primary=(await cap.locator('.action-button').boundingBox())!;
    const secondary=(await cap.locator('.cap-review-link').boundingBox())!;
    expect(secondary.y).toBeGreaterThanOrEqual(primary.y+primary.height);
    expect(Math.abs(primary.x-secondary.x)).toBeLessThanOrEqual(1);
    await noOverflow(page);
    if (width===390 || width===1440) {
      expect((await new AxeBuilder({page}).include('.property-navigation').include('.cap-guidance').analyze()).violations).toEqual([]);
      await propertyNav.screenshot({path:info.outputPath(`property-navigation-${width}.png`)});
      await cap.screenshot({path:info.outputPath(`property-cap-guide-${width}.png`)});
    }
    if (width===390) {
      await page.evaluate(()=>{document.documentElement.style.zoom='2';});
      await noOverflow(page);
    }
  }
});

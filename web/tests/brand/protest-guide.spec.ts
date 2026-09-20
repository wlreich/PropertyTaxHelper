import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { protestGuide } from '../../src/content/protest-guide';

async function bounds(page: import('@playwright/test').Page) {
  const geometry = await page.evaluate(() => ({ width: window.innerWidth, scroll: document.documentElement.scrollWidth,
    overflow: Array.from(document.querySelectorAll('body *')).filter(element => element.getBoundingClientRect().right > window.innerWidth + 1 && !element.closest('.guide-table-scroll')).map(element => `${element.tagName}.${element.className}`).slice(0, 15),
  }));
  expect(geometry.scroll, JSON.stringify(geometry)).toBeLessThanOrEqual(geometry.width + 1);
}

test('approved initial states, shared shell, hearing content, responsive layout and accessibility', async ({ page }, info) => {
  await page.goto('/protest-guide');
  await expect(page.getByRole('heading', {name:'Your appraisal deserves a second look.'})).toBeVisible();
  await expect(page.locator('.brand-logo')).toBeVisible();
  const desktop = page.viewportSize()!.width > 900;
  const hearing = page.locator('#arb-hearing-toggle');
  await expect(hearing).toHaveAttribute('aria-expanded', String(desktop));
  await expect(page.getByRole('navigation', {name:'Guide chapters'})).toBeVisible({visible:desktop});
  if (!desktop) await expect(page.locator('.guide-chapter[open]')).toHaveCount(0);
  await bounds(page);
  await page.screenshot({path:info.outputPath('guide-initial.png'), fullPage:true});
  if (!desktop) { await hearing.focus(); await page.keyboard.press('Enter'); }
  await expect(page.locator('#arb-hearing-content')).toBeVisible();
  await expect(page.locator('.guide-hearing-roles')).toContainText('Independently evaluates both sides and decides');
  await expect(page.locator('.guide-founder-note')).toContainText('This is one homeowner’s experience');
  await expect(page.locator('#arb-hearing-content')).toContainText('Continuing to a decision carries uncertainty');
  await expect(page.locator('#arb-hearing-content')).toContainText('Build a packet the ARB can follow');
  if (page.viewportSize()!.width <= 700) {
    const roles = await page.locator('.guide-hearing-roles dl > div').all();
    expect((await roles[1].boundingBox())!.y).toBeGreaterThan((await roles[0].boundingBox())!.y);
  }
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  await page.locator('.guide-hearing-roles').screenshot({path:info.outputPath('hearing-roles.png')});
  await page.locator('.guide-founder-note').screenshot({path:info.outputPath('founder-note.png')});
  await page.locator('.guide-print-panel').screenshot({path:info.outputPath('download-panel.png')});
  await bounds(page);
  await hearing.focus(); await page.keyboard.press('Space');
  await expect(hearing).toBeFocused();
  await expect(page.locator('#arb-hearing-content')).toBeHidden();
});

test('stable chapter fragments open on reload and back/forward; multiple chapters remain open', async ({ page }) => {
  await page.goto('/protest-guide?property=100#working-with-agent');
  const agent = page.locator('#working-with-agent-toggle');
  await expect(agent).toHaveAttribute('aria-expanded', 'true');
  await expect(agent).toBeFocused();
  await expect(agent).toBeInViewport();
  await page.reload();
  await expect(agent).toHaveAttribute('aria-expanded', 'true');
  const desktop = page.viewportSize()!.width > 900;
  if (desktop) {
    const nav = page.getByRole('navigation', {name:'Guide chapters'});
    await nav.getByRole('link', {name:/05/}).click();
    await expect(page).toHaveURL(/#diy-evidence$/);
    await expect(page.locator('#diy-evidence-toggle')).toBeFocused();
    await expect(nav.getByRole('link', {name:/05/})).toHaveAttribute('aria-current','location');
    await nav.getByRole('link', {name:/06/}).click();
  } else {
    // Fragment navigation through actual links, as from an external shared guide link.
    await page.evaluate(() => { window.location.hash = 'diy-evidence'; });
    await expect(page.locator('#diy-evidence-toggle')).toBeFocused();
    await page.evaluate(() => { window.location.hash = 'informal-review-records'; });
  }
  await expect(page.locator('#informal-review-records-toggle')).toBeFocused();
  await expect(page.locator('#working-with-agent')).toHaveAttribute('open','');
  await expect(page.locator('#diy-evidence')).toHaveAttribute('open','');
  await page.goBack();
  await expect(page.locator('#diy-evidence-toggle')).toBeFocused();
  await page.goForward();
  await expect(page.locator('#informal-review-records-toggle')).toBeFocused();
  await expect(page.getByRole('link', {name:'← Back to property overview'})).toHaveAttribute('href','/property/100');
  await bounds(page);
});

test('all chapters, examples, sources and tables survive; 200% text and zoom reflow', async ({page}, info) => {
  await page.goto('/protest-guide');
  for (const chapter of protestGuide.chapters) {
    const button = page.locator(`#${chapter.anchor}-toggle`);
    if (await button.getAttribute('aria-expanded') !== 'true') await button.click();
    for (const section of chapter.sections) {
      await expect(page.locator(`#${section.id}`)).toBeVisible();
      for (const link of section.sourceLinks) await expect(page.locator(`#${section.id} a`).filter({hasText:link.label}).first()).toHaveAttribute('href',link.url);
    }
  }
  await expect(page.locator('.guide-table-scroll')).toHaveCount(6);
  await expect(page.locator('main')).toContainText('Please provide existing records for tax year');
  await expect(page.locator('main')).toContainText('Could you help me identify a small set');
  await expect(page.locator('main')).toContainText('−$350');
  await expect(page.locator('main')).toContainText('$583,000');
  await expect(page.locator('main')).toContainText('or a confirmed 2027');
  await expect(page.locator('main')).not.toContainText('Editorial notes for ParcelSavvy');
  await expect(page.locator('main')).not.toContainText('Draft for website content review');
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  await bounds(page);
  await page.locator('.guide-table-scroll').first().screenshot({path:info.outputPath('guide-table.png')});
  await page.evaluate(() => { document.documentElement.style.fontSize='200%'; });
  await bounds(page);
  await page.locator('#tax-system-toggle').scrollIntoViewIfNeeded();
  await page.screenshot({path:info.outputPath('guide-enlarged-text.png')});
  await page.evaluate(() => { document.documentElement.style.fontSize=''; document.documentElement.style.zoom='2'; });
  await bounds(page);
  await page.evaluate(() => { document.documentElement.style.zoom=''; });
});

test('both PDF controls deliver the same ungated versioned PDF, and property/home links work', async ({page, request}) => {
  await page.goto('/');
  const navigation = page.getByRole('navigation', {name:'Main navigation'});
  if (page.viewportSize()!.width <= 700) await navigation.locator('summary').click();
  await navigation.getByRole('link', {name:'Protest Guide', exact:true}).click();
  await expect(page).toHaveURL(/\/protest-guide$/);
  const links = page.getByRole('link', {name:'Download printable PDF',exact:true});
  await expect(links).toHaveCount(2);
  const href = await links.first().getAttribute('href');
  await expect(links.last()).toHaveAttribute('href',href!);
  const response = await request.get(href!);
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toContain('application/pdf');
  expect(response.headers()['content-disposition']).toContain('ParcelSavvy-Protest-Guide.pdf');
  expect((await response.body()).subarray(0,5).toString()).toBe('%PDF-');
  for (const link of await links.all()) {
    const downloadPromise = page.waitForEvent('download');
    await link.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('ParcelSavvy-Protest-Guide.pdf');
  }
  await page.goto('/property/100');
  await page.getByRole('navigation', {name:'Property tools'}).getByRole('link', {name:'Protest Guide'}).click();
  await expect(page).toHaveURL(/\/protest-guide\?property=100/);
  await page.getByRole('link', {name:'← Back to property overview'}).click();
  await expect(page).toHaveURL(/\/property\/100$/);
});

test('native disclosures and PDF remain usable without JavaScript', async ({browser, baseURL, viewport}) => {
  const context = await browser.newContext({javaScriptEnabled:false, viewport:viewport!});
  const page = await context.newPage();
  await page.goto(`${baseURL}/protest-guide`);
  await expect(page.locator('#tax-system-toggle')).not.toHaveAttribute('aria-expanded');
  await page.locator('#tax-system-toggle').click();
  await expect(page.locator('#tax-system-content')).toBeVisible();
  await expect(page.locator('#tax-system-content')).toContainText('$2,220');
  await bounds(page);
  const pdf = await page.getByRole('link', {name:'Download printable PDF',exact:true}).first().getAttribute('href');
  expect((await context.request.get(`${baseURL}${pdf}`)).headers()['content-type']).toContain('application/pdf');
  await context.close();
});

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { performance } from 'node:perf_hooks';

// Public GET-only journeys. Never submit suggestions, sign in, or open checkout.
test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) return route.abort('blockedbyclient');
    return route.continue();
  });
});

test('deployed home and real search remain usable', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('What happened to your property appraisal?');
  const search = page.getByRole('combobox', { name: 'Property address or property ID' });
  await expect(search).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  await info.attach('home-copy.txt', { body: await page.locator('body').innerText(), contentType: 'text/plain' });
  await page.screenshot({ path: info.outputPath('deployed-home.png'), fullPage: true });
  const trigger = page.getByRole('button', { name: 'Suggest a feature or metric' });
  await trigger.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await search.fill('1104 Paw');
  const suggestionStart = performance.now();
  const option = page.getByRole('option').filter({ hasText: '736302' });
  await expect(option).toBeVisible();
  const suggestionMs = Math.round(performance.now() - suggestionStart);
  await search.press('Escape');
  const submitStart = performance.now();
  await search.press('Enter');
  const result = page.locator('.result-card').filter({ hasText: 'ID 736302' });
  await expect(result).toBeVisible();
  const submitMs = Math.round(performance.now() - submitStart);
  await expect(result).toContainText(/1104 PAW PRINT/i);
  await expect(page.locator('.release-badge')).toContainText(/Source: Appraisal District · \d{4}/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await result.click();
  await expect(page).toHaveURL(/\/property\/736302\?/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/1104 PAW PRINT/i);
  await page.goBack();
  await expect(search).toHaveValue('1104 Paw');
  await expect(result).toBeVisible();
  await info.attach('timings.json', { body: JSON.stringify({ url: info.project.use.baseURL, viewport: info.project.name, suggestionMs, submitMs, note: 'Fresh browser, uncontrolled server/CDN cache. Includes debounce. Not a load test or p95.' }, null, 2), contentType: 'application/json' });
  if (suggestionMs > 1000 || submitMs > 3000) info.annotations.push({ type: 'performance-review', description: `Suggestion ${suggestionMs}ms; submit ${submitMs}ms. Review against 1s/3s initial targets.` });
  expect(errors).toEqual([]);
});

test('deployed ID and empty-result search respond within the availability budget', async ({ page }, info) => {
  const samples: { query: string; ms: number }[] = [];
  for (const query of ['736302', 'NoSuchStreetQAZX']) {
    await page.goto('/');
    await page.getByRole('combobox').fill(query);
    const start = performance.now();
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    if (query === '736302') {
      await expect(page.locator('.result-card')).toHaveCount(1);
      await expect(page.locator('.result-card')).toContainText('ID 736302');
    } else {
      await expect(page.locator('.empty-state')).toBeVisible();
      await expect(page.locator('.result-card')).toHaveCount(0);
    }
    const ms = Math.round(performance.now() - start);
    samples.push({ query, ms });
    expect(ms, `Search ${query} exceeded the initial 10s availability budget`).toBeLessThan(10_000);
  }
  await info.attach('search-samples.json', { body: JSON.stringify(samples, null, 2), contentType: 'application/json' });
});

import { test, expect, type Page, type Route } from '@playwright/test';

const endpoint = '**/api/search/suggestions?*';
const input = (page: Page) => page.getByRole('combobox', { name: 'Property address or property ID' });
const payload = (address = '1104 CEDAR ST') => ({
  status: 'ok', has_more: false,
  items: [{ property_id: '990016', address, city: 'FIXTURE CITY', postal_code: '78700', is_parkland: false }],
});

async function pausedHome(page: Page) {
  await page.clock.install({ time: new Date('2026-09-19T12:00:00Z') });
  await page.goto('/');
  await input(page).fill('');
  await page.clock.pauseAt(new Date('2026-09-19T13:00:00Z'));
}

test('T01: debounce waits 300ms and coalesces rapid edits into one request', async ({ page }) => {
  const queries: string[] = [];
  await page.route(endpoint, async route => {
    queries.push(new URL(route.request().url()).searchParams.get('q')!);
    await route.fulfill({ json: payload() });
  });
  await pausedHome(page);
  await input(page).fill('110');
  await page.clock.runFor(200);
  await input(page).fill('1104');
  await page.clock.runFor(200);
  await input(page).fill('1104 Cedar');
  await page.clock.runFor(299);
  expect(queries).toEqual([]);
  const response = page.waitForResponse(endpoint);
  await page.clock.runFor(1);
  await response;
  await expect(page.getByRole('option')).toHaveText(/1104 CEDAR ST/);
  expect(queries).toEqual(['1104 Cedar']);
});

test('T02: short input and clearing before debounce send no requests', async ({ page }) => {
  const queries: string[] = [];
  await page.route(endpoint, async route => {
    queries.push(route.request().url());
    await route.fulfill({ json: payload() });
  });
  await pausedHome(page);
  await input(page).fill('ab');
  await page.clock.runFor(500);
  await input(page).fill('Cedar');
  await page.clock.runFor(200);
  await input(page).fill('');
  await page.clock.runFor(500);
  expect(queries).toEqual([]);
  await expect(page.getByRole('listbox')).toBeHidden();
  await expect(input(page)).toHaveAttribute('aria-expanded', 'false');
});

test('T03: a delayed old response cannot replace the latest results', async ({ page }) => {
  let oldRoute: Route | undefined;
  await page.route(endpoint, async route => {
    if (new URL(route.request().url()).searchParams.get('q') === '1104 Alder') oldRoute = route;
    else await route.fulfill({ json: payload() });
  });
  await page.goto('/');
  await input(page).fill('1104 Alder');
  await expect.poll(() => !!oldRoute).toBe(true);
  await expect(page.locator('#search-suggestion-status')).toHaveText('Finding matching addresses…');
  await input(page).fill('1104 Cedar');
  await expect(page.getByRole('option')).toContainText('1104 CEDAR ST');
  await oldRoute!.fulfill({ json: payload('1104 ALDER ST') });
  await expect(page.getByRole('option')).toHaveCount(1);
  await expect(page.getByRole('option')).toContainText('1104 CEDAR ST');
  await expect(page.getByText('1104 ALDER ST', { exact: true })).toHaveCount(0);
});

test('T04: clearing during an in-flight request keeps the list closed', async ({ page }) => {
  let pending: Route | undefined;
  await page.route(endpoint, route => { pending = route; });
  await page.goto('/');
  await input(page).fill('1104 Cedar');
  await expect.poll(() => !!pending).toBe(true);
  await input(page).fill('');
  await pending!.fulfill({ json: payload() });
  await expect(page.getByRole('option')).toHaveCount(0);
  await expect(input(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#search-suggestion-status')).toBeEmpty();
});

for (const failure of ['503', 'malformed', 'offline'] as const) {
  test(`T05: ${failure} suggestions preserve manual search and recover on editing`, async ({ page }) => {
    await page.route(endpoint, async route => {
      if (failure === 'offline') await route.abort('internetdisconnected');
      else if (failure === '503') await route.fulfill({ status: 503, json: { status: 'unavailable' } });
      else await route.fulfill({ json: { status: 'ok', items: [{ unsafe: true }] } });
    });
    await page.goto('/');
    await input(page).fill('Oak');
    await expect(page.locator('#search-suggestion-status')).toContainText('You can still search.');
    await expect(input(page)).toHaveValue('Oak');
    await input(page).press('Enter');
    await expect(page.locator('.result-card')).toHaveCount(2);
    await page.unroute(endpoint);
    await input(page).fill('1104 Cedar');
    await expect(page.getByRole('option')).toHaveCount(1);
    await expect(page.getByRole('option')).toContainText('1104 CEDAR ST');
  });
}

test('T06: normalized repeat query uses cache and Escape leaves input focus', async ({ page }) => {
  let requests = 0;
  await page.route(endpoint, async route => { requests++; await route.fulfill({ json: payload() }); });
  await pausedHome(page);
  await input(page).fill('1104 Cedar');
  await page.clock.runFor(300);
  await expect(page.getByRole('option')).toHaveCount(1);
  await input(page).press('Escape');
  await expect(page.getByRole('listbox')).toBeHidden();
  await expect(input(page)).toBeFocused();
  await input(page).fill('');
  await input(page).fill('  1104   cedar  ');
  await expect(page.getByRole('option')).toHaveCount(1);
  await page.clock.runFor(500);
  expect(requests).toBe(1);
});

test('T07: slow submitted search is busy, blocks duplicate clicks and settles', async ({ page }) => {
  let pending: Route | undefined;
  let navigations = 0;
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/' && url.searchParams.get('q') === 'Oak') {
      navigations++;
      pending = route;
    } else await route.continue();
  });
  await page.goto('/');
  await input(page).fill('Oak');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect.poll(() => !!pending).toBe(true);
  await expect(page.locator('form.search-form')).toHaveAttribute('aria-busy', 'true');
  await expect(page.getByRole('button', { name: 'Searching…', exact: true })).toBeDisabled();
  expect(navigations).toBe(1);
  await pending!.continue();
  await expect(page.locator('.result-card')).toHaveCount(2);
  await expect(page.locator('form.search-form')).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByRole('button', { name: 'Search', exact: true })).toBeEnabled();
});

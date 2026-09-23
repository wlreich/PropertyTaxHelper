import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('H01: copy inventory, responsive evidence and read-only suggestion dialog', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  const trustSection = page.locator('#about');
  await expect(trustSection.getByRole('heading', { level: 2 })).toHaveText('Independent by design. Built for homeowners.');
  await expect(trustSection.getByRole('heading', { level: 3 })).toHaveText([
    'Independent perspective',
    'Answers in plain language',
    'Evidence you can use',
  ]);
  await expect(trustSection).toContainText('Understand what changed in your assessment, how the Appraisal District arrived there, and which details deserve a closer look.');
  await expect(trustSection).toContainText('Review your value history, compare nearby homes, and identify the questions worth asking before you decide whether to protest.');
  await expect(trustSection).not.toContainText('You decide what comes next');
  await expect(trustSection).not.toContainText('Explore the information at your own pace');
  await page.evaluate(() => document.fonts.ready);
  await info.attach('home-copy.txt', { body: await page.locator('body').innerText(), contentType: 'text/plain' });
  const trigger = page.getByRole('button', { name: 'Suggest a feature or metric' });
  await trigger.focus();
  await trigger.press('Enter');
  await expect(page.getByRole('dialog', { name: 'What would help you?' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(trigger).toBeFocused();
  await page.screenshot({ path: info.outputPath('home-full.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('S01: exact ID, source labels, property drilldown and results Back', async ({ page }) => {
  await page.goto('/?q=990016');
  const result = page.locator('.result-card');
  await expect(result).toHaveCount(1);
  await expect(result).toContainText('1104 CEDAR ST');
  await expect(result).toContainText('ID 990016');
  await expect(page.locator('.release-badge')).toHaveText('Source: Appraisal District · 2026 certified');
  await expect(page.getByText(/Appraisal District export:/)).toBeVisible();
  await result.click();
  await expect(page).toHaveURL(/\/property\/990016\?/);
  await page.goBack();
  await expect(page.getByRole('combobox')).toHaveValue('990016');
  await expect(page.locator('.result-card')).toHaveCount(1);
});

test('S02: invalid and overlong URL queries show validation without result cards', async ({ page }) => {
  for (const query of ['ab', 'A'.repeat(121), 'one two three four five six seven eight nine']) {
    await page.goto(`/?q=${encodeURIComponent(query)}`);
    await expect(page.getByRole('main').getByRole('alert')).toContainText('Let’s narrow that down');
    await expect(page.locator('.result-card')).toHaveCount(0);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  }
});

test('S03: empty high page offers a usable return to first results', async ({ page }) => {
  await page.goto('/?q=Oak&page=249');
  await expect(page.getByRole('heading', { name: 'You’ve reached the end of these results' })).toBeVisible();
  await page.getByRole('link', { name: 'Return to first page' }).click();
  await expect(page.locator('.result-card')).toHaveCount(2);
  await expect(page.getByRole('combobox')).toHaveValue('Oak');
  await expect(page).toHaveURL(/\?q=Oak$/);
});

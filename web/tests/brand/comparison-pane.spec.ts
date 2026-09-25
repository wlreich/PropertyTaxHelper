import {test, expect, type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {propertyAdjustments} from '../../src/lib/property-adjustments';
import {currency} from '../../src/lib/property-search';

const release = '11111111-1111-4111-8111-111111111111';
const prior = '22222222-2222-4222-8222-222222222222';
const pane = (page: Page) => page.locator('#adjustment-breakdown');
const trigger = (page: Page, id: string) => page.locator(`#inspect-property-${id}`);
const signed = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${currency(Math.abs(value))}`;

test.beforeEach(async ({}, info) => {
  test.skip(info.project.name !== 'width-1440', 'Bounded pane journeys set their own viewports.');
});

test('desktop inspection switches in place and keeps selection, navigation and focus contracts', async ({page}) => {
  await page.goto('/property/100/compare?view=adjusted');
  const viewExplanation = page.locator('#comparison-view-description');
  await expect(viewExplanation).toHaveText('Reported values are the Appraisal District’s market values for these homes. Estimated adjusted values use adjustment logic the district provided through open records to account for recorded differences between each home and yours. ParcelSavvy calculates these estimates; they are not the district’s official results.');
  const adjustedMethod = page.getByText('How adjusted values work', {exact: true});
  await adjustedMethod.focus(); await page.keyboard.press('Enter');
  await expect(adjustedMethod.locator('..')).toHaveJSProperty('open', true);
  await expect(pane(page)).toHaveCount(0);
  await trigger(page, '120').click();
  await expect(page.locator('#adjustment-breakdown-heading')).toBeFocused();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(trigger(page, '120')).toHaveAttribute('aria-controls', 'adjustment-breakdown');
  expect(await page.locator('.comparison-title h2, #adjusted-comparison-heading, #adjustment-breakdown-heading').evaluateAll(nodes => nodes.map(node => node.tagName))).toEqual(['H2', 'H3', 'H4']);
  const original = await pane(page).elementHandle();
  const factors = page.getByRole('region', {name: 'Adjustment factors and sources'});
  const method = pane(page).getByText('How this is calculated · Land', {exact: true});
  await method.click();
  await factors.focus(); await page.keyboard.press('End');
  await expect.poll(() => factors.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
  const position = await page.evaluate(() => scrollY);
  // Focus without scrolling so the assertion isolates the switch from pointer auto-scroll.
  await trigger(page, '121').evaluate(node => node.focus({preventScroll: true}));
  await page.keyboard.press('Enter');
  await expect(pane(page)).toHaveAccessibleName('Adjustment breakdown · 121 CYPRESS ST');
  expect(await original!.evaluate(node => node === document.querySelector('#adjustment-breakdown'))).toBe(true);
  expect(await page.evaluate(() => scrollY)).toBe(position);
  await expect(factors).toHaveJSProperty('scrollTop', 0);
  await expect(page.locator('#adjustment-breakdown-heading')).toBeFocused();
  await expect(page.locator('.comparison-inspected')).toHaveCount(1);
  await expect(page.getByRole('button', {name: 'Edit selection (3)', exact: true})).toBeVisible();
  await pane(page).getByText('How this is calculated · Land', {exact: true}).click();
  await trigger(page, '121').click();
  await expect(pane(page).locator('details').filter({hasText: 'How this is calculated · Land'})).toHaveAttribute('open', '');
  // Escape elsewhere must leave this nonmodal region open.
  await page.keyboard.press('Escape'); await expect(pane(page)).toHaveCount(1);
  await pane(page).getByRole('button', {name: 'Close breakdown ×'}).click();
  await expect(trigger(page, '121')).toBeFocused();
  await expect(page.locator('.comparison-inspected')).toHaveCount(0);
  await trigger(page, '120').click();
  await page.getByRole('button', {name: 'Edit selection (3)', exact: true}).click();
  await page.getByRole('button', {name: 'Clear selections', exact: true}).click();
  await page.getByRole('button', {name: 'Cancel changes', exact: true}).click();
  await expect(pane(page)).toHaveAccessibleName('Adjustment breakdown · 120 CYPRESS ST');
  await expect(page.getByRole('button', {name: 'Edit selection (3)', exact: true})).toBeFocused();
  await page.getByRole('button', {name: 'Edit selection (3)', exact: true}).click();
  await page.getByRole('button', {name: 'Remove 120 CYPRESS ST (120)', exact: true}).click();
  await page.getByRole('complementary', {name: 'Your comparison set'}).getByRole('button', {name: 'Apply selection', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Edit selection (2)', exact: true})).toBeVisible();
  await expect(page).toHaveURL(/selected=121%2C122.*step=results/);
  await expect(pane(page)).toHaveCount(0); await expect(trigger(page, '120')).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(/step=select/);
  await page.getByRole('button', {name: 'Cancel changes', exact: true}).click();
  await expect(trigger(page, '120')).toBeVisible();
  await trigger(page, '120').click();
  await page.getByRole('button', {name: 'Reported values', exact: true}).click();
  await expect(pane(page)).toHaveCount(0);
  await expect(viewExplanation).toBeVisible();
  await page.getByRole('button', {name: 'Estimated adjusted values', exact: true}).click();
  await expect(pane(page)).toHaveCount(0);
  await expect(viewExplanation).toBeVisible();
  await trigger(page, '120').click();
  await page.getByLabel('Assessment release').selectOption(prior);
  await expect(pane(page)).toHaveCount(0);
  await trigger(page, '120').click();
  await expect(pane(page)).toContainText('2025 certified');
  await expect(pane(page)).toContainText('$390,000');
  await page.keyboard.press('Escape');
  await expect(trigger(page, '120')).toBeFocused();
  await page.goto('/property/123/compare?view=adjusted&selected=120');
  await expect(pane(page)).toHaveCount(0);
});

test('mobile inline placement, resize continuity, complete scroll range and visual layouts', async ({page}, info) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('/property/100/compare?view=adjusted');
  const viewExplanation = page.locator('#comparison-view-description');
  await expect(viewExplanation).toHaveText('Reported values are the Appraisal District’s market values for these homes. Estimated adjusted values use adjustment logic the district provided through open records to account for recorded differences between each home and yours. ParcelSavvy calculates these estimates; they are not the district’s official results.');
  const adjustedMethod = page.getByText('How adjusted values work', {exact: true});
  await adjustedMethod.focus(); await page.keyboard.press('Enter');
  await expect(adjustedMethod.locator('..')).toHaveJSProperty('open', true);
  await trigger(page, '120').click();
  expect(await pane(page).evaluate(node => node.previousElementSibling?.querySelector('button')?.id)).toBe('inspect-property-120');
  await expect(page.locator('.comparison-detail-scroll')).toHaveCSS('overflow-y', 'visible');
  await trigger(page, '122').click();
  await expect(pane(page)).toHaveAccessibleName('Adjustment breakdown · 122 CYPRESS ST');
  await pane(page).getByRole('button', {name: 'Close breakdown ×'}).click();
  await expect(trigger(page, '122')).toBeFocused();
  await page.getByRole('button', {name: 'Reported values', exact: true}).click();
  await expect(viewExplanation).toBeVisible();
  await page.getByRole('button', {name: 'Estimated adjusted values', exact: true}).click();
  await expect(viewExplanation).toBeVisible();
  await trigger(page, '120').click();
  const method = pane(page).getByText('How this is calculated · Land', {exact: true});
  await method.click(); await method.focus();
  const original = await pane(page).elementHandle();
  for (const width of [1440, 390]) {
    await page.setViewportSize({width, height: 900});
    await expect(method).toBeFocused();
    await expect(method.locator('..')).toHaveAttribute('open', '');
    expect(await original!.evaluate(node => node === document.querySelector('#adjustment-breakdown'))).toBe(true);
    await expect(page.locator('[id="adjustment-breakdown"]')).toHaveCount(1);
  }
  await page.keyboard.press('Escape'); await expect(trigger(page, '120')).toBeFocused();
  // Existing long-address fixture is outside the recommendation pool.
  await page.goto('/property/100/compare?view=adjusted&selected=124,120');
  await trigger(page, '124').click();
  await expect(pane(page).locator('.comparison-detail-values')).not.toContainText('Not available');
  for (const [width, height] of [[1440, 1000], [1280, 720], [390, 844], [768, 1000], [1103, 900], [1105, 900]]) {
    await page.setViewportSize({width, height});
    await pane(page).scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const details = page.locator('.comparison-detail-scroll');
    const desktop = await details.evaluate(node => getComputedStyle(node).overflowY === 'auto');
    if (desktop) {
      const bounds = await pane(page).boundingBox();
      expect(bounds!.height).toBeLessThanOrEqual(height - 32);
      await details.focus(); await page.keyboard.press('End');
    } else await pane(page).getByRole('link', {name: 'View property records'}).scrollIntoViewIfNeeded();
    await expect(pane(page).getByRole('link', {name: 'View property records'})).toBeInViewport();
    await expect(pane(page).getByRole('heading', {name: 'Neighborhood', exact: true})).toHaveCount(1);
    await details.evaluate(node => {node.scrollTop = 0;});
    if ([1440, 1280, 390].includes(width)) {
      await pane(page).scrollIntoViewIfNeeded();
      const path = info.outputPath(`pane-${width}x${height}.png`);
      await page.locator('.comparison-inspection-grid').screenshot({path});
      await info.attach(`Pane ${width}x${height}`, {path, contentType: 'image/png'});
    }
  }
  await page.setViewportSize({width: 1280, height: 720});
  await page.evaluate(() => {document.documentElement.style.fontSize = '200%';});
  await expect(page.locator('.comparison-detail-scroll')).toHaveCSS('overflow-y', 'visible');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => {document.documentElement.style.fontSize = '';});
  const violations = (await new AxeBuilder({page}).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations;
  expect(violations).toEqual([]);
});

test('rendered totals, every factor and input retain model output across ordinary, secondary, partial and prior-year cases', async ({page}) => {
  for (const [subject, comparable, source] of [['100', '120', release], ['123', '120', release], ['100', '123', release], ['100', '120', prior]]) {
    const response = await page.request.get(`/api/property/${subject}/comparisons?source=${source}&q=${comparable}`);
    expect(response.ok()).toBe(true);
    const {data} = await response.json();
    const property = data.matches.find((item: {property_id: string}) => item.property_id === comparable);
    const model = propertyAdjustments(data.subject, property, data.release.tax_year);
    await page.goto(`/property/${subject}/compare?view=adjusted&selected=${comparable}&release=${source}`);
    await trigger(page, comparable).click();
    await expect(pane(page).locator('.comparison-detail-values')).toContainText(currency(model.property.market_value));
    await expect(pane(page).locator('.comparison-detail-values')).toContainText(model.total === null ? 'Not available' : signed(model.total));
    await expect(pane(page).locator('.comparison-detail-values')).toContainText(model.adjustedValue === null ? 'Not available · partial calculation' : currency(model.adjustedValue));
    await expect(pane(page).locator('.comparison-factor')).toHaveCount(model.lines.length);
    for (const line of model.lines) {
      const factor = pane(page).locator('.comparison-factor').filter({has: page.getByRole('heading', {name: line.factor, exact: true})});
      await expect(factor.locator('.comparison-factor-heading strong')).toHaveText(line.amount === null ? 'Not estimated' : signed(line.amount));
      for (const input of line.inputs) {
        const value = input.value === null ? 'Not reported' : typeof input.value === 'string' ? input.value : input.unit === 'year' ? String(input.value) : input.unit === 'number' ? input.value.toLocaleString('en-US', {maximumFractionDigits: 2}) : currency(input.value);
        await expect(factor.locator('dl > div').filter({has: page.getByText(input.label, {exact: true})})).toContainText(value);
      }
      await factor.locator('summary').click();
      await expect(factor.locator('details p')).toHaveText(line.explanation);
    }
    await expect(pane(page)).toContainText(`${data.release.tax_year} certified`);
    await expect(pane(page)).toContainText(data.release.export_date);
  }
  await page.goto('/property/100/compare?view=adjusted&selected=');
  await expect(pane(page)).toHaveCount(0);
  await expect(page.getByText('Edit the comparison set to choose properties for adjustment.', {exact: false})).toBeVisible();
});

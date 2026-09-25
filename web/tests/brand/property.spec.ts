import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("taxable-only reduction stays distinct from unchanged market value and protest success", async ({page}, info) => {
  await page.goto('/property/101');
  const summary=page.locator('.current-assessment');
  await expect(summary).toContainText('$600,000');
  await expect(summary).toContainText('Reduction from proposed');
  await expect(summary).toContainText('Proposed and certified values match');
  const result=summary;
  await expect(summary).toContainText('Protest recorded');
  await expect(summary).not.toContainText('successful protest');
  await expect(page.getByRole('heading',{name:'Your taxable value came down'})).toHaveCount(0);
  expect((await new AxeBuilder({page}).include('.current-assessment').analyze()).violations).toEqual([]);
  await page.evaluate(()=>{document.documentElement.style.zoom='2';});
  const zoomLayout = await page.evaluate(()=>({
    width: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    overflowing: Array.from(document.querySelectorAll('body *')).filter(element=>element.getBoundingClientRect().right>window.innerWidth+1).map(element=>`${element.tagName}.${element.className}`).slice(0,20),
  }));
  expect(zoomLayout.scrollWidth, JSON.stringify(zoomLayout)).toBeLessThanOrEqual(zoomLayout.width);
  await page.evaluate(()=>{document.documentElement.style.zoom='1';});
  const capture=info.outputPath('taxable-only-result.png');
  await result.screenshot({path:capture});
  await info.attach('Taxable-only result',{path:capture,contentType:'image/png'});
});
test("combined property view: dates, missing feature, exemptions, keyboard and responsive layout", async ({
  page,
}, info) => {
  await page.goto("/property/100?q=Oak&page=0&all=1");
  await expect(
    page.getByRole("heading", { name: "123 N OAK ST", exact: true }),
  ).toBeVisible();
  const facts = page.getByRole("definition").filter({hasText:"sq ft"});
  const quickFacts = page.locator(".overview-quick-facts");
  await expect(quickFacts).toContainText("Living area");
  await expect(quickFacts).toContainText("Year built");
  expect((await quickFacts.boundingBox())!.y).toBeLessThan((await page.locator("#season-heading").boundingBox())!.y);
  const tools = page.getByRole("navigation", {name:"Property tools"});
  await expect(tools.locator('[aria-current="page"]')).toHaveText("Overview");
  await expect(tools.locator('[aria-disabled="true"]')).toHaveCount(0);
  const items = tools.locator(".property-navigation-item");
  const overviewBox = (await items.nth(0).boundingBox())!;
  const neighborhoodBox = (await items.nth(2).boundingBox())!;
  expect(neighborhoodBox.y).toBeGreaterThanOrEqual(overviewBox.y);
  const navigation = page.getByRole("navigation", {name:"Property sections"});
  await expect(navigation).toContainText("On this page");
  expect((await tools.boundingBox())!.y).toBeGreaterThan((await quickFacts.boundingBox())!.y);
  expect((await tools.boundingBox())!.y).toBeLessThan((await navigation.boundingBox())!.y);
  for (const [label, target] of [["Cap & exemptions", "exemptions-heading"], ["Value drivers", "market-adjustment-heading"], ["Property details", "property-facts-heading"], ["History", "history-heading"]]) {
    const link = navigation.getByRole("link", {name:label, exact:true});
    await link.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(`#${target}`)).toBeFocused();
    await expect(page.locator(`#${target}`)).toBeInViewport();
  }
  await expect(page.locator("#property-details")).toBeVisible();
  await expect(facts.first()).toBeVisible();
  await page.locator("#about-records-heading").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("ParcelSavvy uses dated Appraisal District releases.", {exact:false})).toBeVisible();
  const sources = page.locator('.overview-source');
  await expect(sources).toContainText('Latest assessment shown: 2026 certified record · Jul 18, 2026');
  await expect(sources.getByRole('link', {name:'Official Appraisal District property record (2026)',exact:false})).toHaveAttribute('href','https://travis.prodigycad.com/property-detail/100/2026');
  await expect(sources.getByRole('link', {name:'Report a data issue',exact:true})).toHaveAttribute('href','/report-data-issue?property=100');
  await expect(sources.getByRole('link', {name:'Download source appraisal export (ZIP)',exact:false})).toHaveAttribute('href',/\.zip$/i);
  await expect(sources).toContainText('2026 certified countywide appraisal export');
  await expect(sources).not.toContainText('Sources & calculation details');
  await expect(sources).not.toContainText('Later Appraisal District corrections may exist');
  await expect(sources).not.toContainText('Bold changes are at least');
  const sourceCapture=info.outputPath('source-links.png');await sources.screenshot({path:sourceCapture});await info.attach('Source links',{path:sourceCapture,contentType:'image/png'});
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("definition").filter({hasText:"No longer separately listed"}),
  ).toBeVisible();
  const assessmentSummary = page.locator('.current-assessment');
  for (const value of ['$450,000','$100,000','↑ $50,000','Protest recorded','FIXTURE TAX PARTNERS']) await expect(assessmentSummary).toContainText(value);
  await expect(page.getByRole('heading',{name:'Looks like a successful protest!'})).toHaveCount(0);
  const values = page.getByRole('region',{name:'What is the cap doing for you?'});
  await expect(values).toContainText('Leander ISD');
  await expect(values).toContainText('$420,000');
  expect((await assessmentSummary.boundingBox())!.y).toBeLessThan((await values.boundingBox())!.y);
  await page.locator("#taxing-authorities summary").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#taxing-authorities")).toHaveAttribute("open", "");
  await expect(page.locator(".exemption-breakdowns")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByText("No longer separately listed", {exact:true})).toBeVisible();
  await expect(page.getByRole("heading", {name:"Taxable values by authority"})).toBeVisible();
  await expect(page.locator(".current-assessment-evidence").first()).toContainText("FIXTURE TAX PARTNERS");
  const historyToggle = page.getByRole('button', {name:'View 2026 details'});
  await historyToggle.focus(); await page.keyboard.press('Enter');
  const dialog=page.getByRole('dialog',{name:'2026 assessment & protest record'});
  await dialog.locator('summary').filter({hasText:'Dated protest'}).click();
  await expect(dialog).toContainText('Apr 29, 2026');
  await expect(dialog).toContainText('Appraisal District status: EF');
  await expect(dialog).toContainText('FIXTURE TAX PARTNERS');
  await page.keyboard.press('Escape'); await expect(historyToggle).toBeFocused();
  const term = page.getByRole("button", {
    name: "Appraisal District market value",
    exact: false,
  });
  await page.mouse.move(0, 0);
  await term.focus();
  await expect(term).toHaveAttribute("aria-expanded", "true");
  const tooltip = page.locator(`[id="${await term.getAttribute("aria-describedby")}"]`);
  await expect(tooltip).toBeVisible();
  const bounds = await tooltip.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
    info.project.use.viewport!.width,
  );
  await term.press("Escape");
  await expect(tooltip).toBeHidden();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  if (info.project.use.viewport!.width <= 800) {
    for (const caption of await page.locator(".overview-table caption:visible").all()) {
      const captionBounds = await caption.boundingBox();
      const tableBounds = await caption.locator("..").boundingBox();
      expect(captionBounds!.width).toBeGreaterThan(tableBounds!.width * 0.9);
    }
  }
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
  await page.evaluate(() => window.scrollTo(0, 0));
  const capture = info.outputPath("combined-property.png");
  await page.screenshot({ path: capture, fullPage: true });
  await info.attach("Combined property page", {
    path: capture,
    contentType: "image/png",
  });
  await page.goto("/property/100?q=Oak&page=0&all=1");
  await page.getByRole("link", { name: "Back to search results" }).click();
  await expect(page).toHaveURL(/q=Oak.*all=1/);
  await page.goto("/property/102");
  await expect(
    page.getByRole("heading", { name: "Some values need further review" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "More comparison data needed" }),
  ).toBeVisible();
  await expect(page.locator(".current-assessment")).toContainText("Not reported");
});

test('PAR-9 current assessment leads the page and context actions preserve the property', async ({page}, info) => {
  await page.goto('/property/100');
  const hero=page.locator('.current-assessment');
  await expect(hero).toContainText('2026 certified');
  await expect(hero).toContainText('Protest recorded');
  await expect(hero).toContainText('FIXTURE TAX PARTNERS');
  await expect(hero).toContainText('Value change, not tax savings.');
  await expect(hero).toHaveCSS('background-color','rgb(11, 45, 77)');
  const tools=page.getByRole('navigation',{name:'Property tools'});
  const jumps=page.getByRole('navigation',{name:'Property sections'});
  expect((await tools.boundingBox())!.y).toBeLessThan((await hero.boundingBox())!.y);
  expect((await hero.boundingBox())!.y).toBeLessThan((await jumps.boundingBox())!.y);
  if(info.project.use.viewport!.width===1440) expect((await hero.boundingBox())!.width).toBe(1200);
  await expect(page.locator('.overview-context').getByRole('link',{name:'Compare similar properties',exact:true})).toHaveAttribute('href','/property/100/compare');
  await expect(page.getByRole('link',{name:'Explore my neighborhood',exact:true})).toHaveAttribute('href','/property/100/neighborhood');
  const supportLink=page.locator('.overview-context').getByRole('link',{name:'Support ParcelSavvy',exact:false});
  await expect(supportLink).toHaveAttribute('href','/support');
  await expect(page.locator('.overview-source')).not.toContainText('comparable snapshots');
  await expect(page.getByRole('main')).not.toContainText('preliminary snapshot');
  await expect(page.locator('.overview-source')).toContainText('Jul 18, 2026');
  await expect(page.getByRole('main')).not.toContainText('TCAD');
  const heroCapture=info.outputPath('current-assessment.png');
  await hero.screenshot({path:heroCapture});
  await info.attach('Current assessment hero',{path:heroCapture,contentType:'image/png'});
  const contextCapture=info.outputPath('context-and-support.png');
  await page.locator('.overview-context').screenshot({path:contextCapture});
  await info.attach('Context and support',{path:contextCapture,contentType:'image/png'});
  await supportLink.click();
  await expect(page).toHaveURL(/\/support$/);
  await expect(page.getByText('Contributions are not charitable donations and are not tax-deductible.')).toBeVisible();
  // This parcel has no detailed history and a US-format export timestamp.
  await page.goto('/property/505?q=Parkdemo&page=1&all=1');
  await expect(page.getByRole('link',{name:'Back to search results'})).toHaveAttribute('href','/?q=Parkdemo&page=1&all=1');
  await expect(page.locator('.current-assessment')).toContainText('Comparable preliminary value unavailable');
});

test('PAR-44 release callout and support action reflow at focused widths', async ({page}, info) => {
  test.skip(info.project.name !== 'width-1440', 'Runs the focused 390/1440 visual matrix once.');
  for (const width of [390, 1440]) {
    await page.setViewportSize({width, height:1000});
    await page.goto('/');
    const callout=page.getByLabel('Current assessment release');
    await expect(callout).toContainText('2026 certified assessment records are available');
    await expect(callout).toContainText('Appraisal District export: 07/18/2026 16:27');
    await expect(callout).not.toContainText('2026 certified results are available');
    await expect(callout).not.toContainText('Certified value export: Jul 18, 2026');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await callout.screenshot({path:info.outputPath(`release-callout-${width}.png`)});

    await page.goto('/property/100');
    const support=page.locator('.overview-donation');
    await expect(support.getByRole('link',{name:'Support ParcelSavvy',exact:false})).toHaveAttribute('href','/support');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await support.screenshot({path:info.outputPath(`property-support-${width}.png`)});
  }

  await page.setViewportSize({width:390,height:1000});
  for (const route of ['/', '/property/100']) {
    await page.goto(route);
    await expect(route==='/'?page.getByLabel('Current assessment release'):page.locator('.overview-donation')).toBeVisible();
    await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath(`${route==='/'?'home':'property'}-390-200-percent.png`),fullPage:true});
  }
});

test('PAR-45 assessment-record disclosure stays concise, reachable and readable', async ({page}, info) => {
  test.skip(info.project.name !== 'width-1440', 'Runs the focused 390/1440 property disclosure matrix once.');
  for (const width of [390, 1440]) {
    await page.setViewportSize({width, height:1000});
    await page.goto('/property/100');
    const sources=page.locator('.overview-source');
    await expect(sources).toContainText('Latest assessment shown: 2026 certified record · Jul 18, 2026');
    const official=sources.getByRole('link',{name:'Official Appraisal District property record (2026)',exact:false});
    await expect(official).toHaveAttribute('href','https://travis.prodigycad.com/property-detail/100/2026');
    await expect(sources.getByRole('link',{name:'Report a data issue',exact:true})).toHaveAttribute('href','/report-data-issue?property=100');
    const disclosure=sources.locator('details');
    const summary=disclosure.getByText('About these assessment records',{exact:true});
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(disclosure).toHaveAttribute('open','');
    await expect(disclosure).toContainText('The District may correct records later, and preliminary and final values can differ.');
    await expect(disclosure).toContainText('Missing or withheld records remain unavailable; ParcelSavvy does not treat them as zero.');
    for(const removed of ['Sources & calculation details','Later corrections may appear','Export times are shown','Bold changes are at least'])await expect(sources).not.toContainText(removed);
    const headingLevels=await page.locator('main h1, main h2, main h3').evaluateAll(nodes=>nodes.filter(node=>node.getClientRects().length>0).map(node=>Number(node.tagName.slice(1))));
    for(let i=1;i<headingLevels.length;i++)expect(headingLevels[i]-headingLevels[i-1]).toBeLessThanOrEqual(1);
    const linkBoxes=await sources.getByRole('link').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect()).map(box=>({left:box.left,right:box.right})));
    for(const box of linkBoxes){expect(box.left).toBeGreaterThanOrEqual(0);expect(box.right).toBeLessThanOrEqual(width+1);}
    expect((await new AxeBuilder({page}).include('.overview-source').analyze()).violations).toEqual([]);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await sources.screenshot({path:info.outputPath(`par45-record-disclosure-${width}.png`)});
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(disclosure).not.toHaveAttribute('open','');
  }

  await page.setViewportSize({width:390,height:1000});
  await page.goto('/property/100');
  await page.locator('#about-records-heading').click();
  await page.evaluate(()=>{document.documentElement.style.zoom='2';});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('par45-record-disclosure-390-200-percent.png'),fullPage:true});

  await page.evaluate(()=>{document.documentElement.style.zoom='';});
  await page.goto('/property/999118');
  await expect(page.locator('.overview-source')).toContainText('2027 preliminary record');
  await expect(page.locator('[data-year="2027"]')).toContainText('Preliminary only');
  await page.locator('#about-records-heading').click();
  await expect(page.locator('.overview-source')).toContainText('Missing or withheld records remain unavailable');
});

test('PAR-51 approved protest, prior-year and cap wording stays evidence-specific and responsive', async ({page}, info) => {
  test.skip(info.project.name !== 'width-1440', 'Runs the focused 390/1440 PAR-51 visual matrix once.');
  const capExplanation='If your home qualified for a homestead exemption last year and this year, the cap generally limits increases in its appraised value to 10%, plus new improvements. Its market value can still rise more.';
  for (const width of [390,1440]) {
    await page.setViewportSize({width,height:1100});
    await page.goto('/property/999014');
    const hero=page.locator('.current-assessment');
    const heading=hero.getByRole('heading',{name:'Protest recorded. Value reduced 20.3% from your preliminary appraisal.'});
    await expect(heading).toBeVisible();
    await expect(hero).toContainText('Your 2026 certified market value is 0.4% lower than in 2025.');
    await expect(hero).toContainText('Protest recorded - Agent not identified.');
    await expect(hero).toContainText('This may indicate that the homeowner protested without an agent.');
    await expect(hero).not.toContainText('The records do not establish what caused a reduction or who handled the case.');
    await expect(hero.locator('.current-assessment-favorable-arrow')).toHaveAttribute('aria-hidden','true');
    const contrast=await hero.locator('.current-assessment-favorable').evaluate(element=>{
      const rgb=(value:string)=>value.match(/[\d.]+/g)!.slice(0,3).map(Number).map(channel=>channel/255).map(channel=>channel<=0.03928?channel/12.92:((channel+0.055)/1.055)**2.4);
      const luminance=(value:string)=>{const [r,g,b]=rgb(value);return 0.2126*r+0.7152*g+0.0722*b;};
      const foreground=luminance(getComputedStyle(element).color),background=luminance(getComputedStyle(element.closest('.current-assessment')!).backgroundColor);
      return (Math.max(foreground,background)+0.05)/(Math.min(foreground,background)+0.05);
    });
    expect(contrast).toBeGreaterThanOrEqual(4.5);
    const arrow=await hero.locator('.current-assessment-favorable-arrow').boundingBox();
    const lead=await hero.locator('.current-assessment-favorable-lead').boundingBox();
    expect(arrow!.y).toBeGreaterThanOrEqual(lead!.y-1);
    expect(arrow!.y+arrow!.height).toBeLessThanOrEqual(lead!.y+lead!.height+1);
    const cap=page.locator('.cap-section');
    await expect(cap).toContainText(capExplanation);
    await expect(cap.locator('.cap-guidance')).toContainText('Your final assessed value is $68,375 below the capped amount on your preliminary appraisal. That final value becomes the starting point for next year’s homestead cap.');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    expect((await new AxeBuilder({page}).include('.current-assessment').include('.cap-section').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
    await hero.screenshot({path:info.outputPath(`par51-hero-${width}.png`)});
    await cap.screenshot({path:info.outputPath(`par51-cap-${width}.png`)});
  }

  await page.goto('/property/999015');
  await expect(page.locator('.current-assessment')).toContainText('Reduction evidence suggests a possible protest; no protest record found');
  await expect(page.locator('.current-assessment')).not.toContainText('Protest recorded. Value reduced');
  await expect(page.locator('.cap-guidance')).toContainText('Your market value fell, but your assessed value did not change. This reduction does not lower next year’s starting point.');

  await page.goto('/property/999016');
  await expect(page.locator('.current-assessment-impact')).toContainText('Your recorded assessed value also fell $53,650 from the preliminary assessed value.');
  await expect(page.locator('.cap-guidance')).toContainText('Your final assessed value is $53,650 lower than on your preliminary appraisal. That final value becomes next year’s starting point.');

  await page.goto('/property/999017');
  await expect(page.locator('.current-assessment')).toContainText('Comparable preliminary value unavailable');
  await expect(page.locator('.cap-guidance')).toContainText('Your 2026 assessed value is the starting point for next year’s homestead cap');
  await expect(page.locator('.cap-guidance')).not.toContainText('lower starting point');
});

test('PAR-9 approved Figma reference property 736164', async ({page},info) => {
  await page.goto('/property/736164');
  await expect(page.getByRole('heading',{level:1})).toHaveText('3709 LAJITAS');
  const hero=page.locator('.current-assessment');
  await expect(hero).toContainText('Your market value rose. Your cap softened the increase.');
  await expect(hero).toContainText('$1,575,313');
  await expect(hero).toContainText('$1,377,354');
  await expect(hero).toContainText('↑ $210,274 · 15.4% vs. 2025');
  await expect(hero).toContainText('↑ $125,214 · 10.0% vs. 2025');
  await expect(hero).toContainText('Proposed and certified values match');
  await expect(hero).toContainText('No protest found in available records');
  await expect(hero).toContainText('Agent not identified');
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await hero.screenshot({path:info.outputPath('reference-736164-hero.png')});
  await page.locator('.overview-context').screenshot({path:info.outputPath('reference-736164-context.png')});
  await page.screenshot({path:info.outputPath('reference-736164-page.png'),fullPage:true});
});

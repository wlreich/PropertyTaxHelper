import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
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
  const navigation = page.getByRole("navigation", {name:"Property sections"});
  for (const [label, target] of [["Property details", "property-facts-heading"], ["Value history", "history-heading"], ["Protest & agent", "representation-heading"], ["Exemptions", "exemptions-heading"]]) {
    const link = navigation.getByRole("link", {name:label, exact:true});
    await link.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(`#${target}`)).toBeFocused();
    await expect(page.locator(`#${target}`)).toBeInViewport();
  }
  await expect(page.locator("#property-details")).toHaveAttribute("open", "");
  await expect(page.getByText("Protest recorded · 2026", {exact:true})).toBeVisible();
  await expect(facts.first()).toBeVisible();
  await page.locator("#property-facts-heading").click();
  await expect(page.locator("#property-details")).not.toHaveAttribute("open");
  await expect(page.getByText("Which property facts or comparable properties support this year’s case?", {exact:true})).toBeVisible();
  const moreQuestions = page.getByText("More questions for your agent", {exact:true});
  await expect(page.getByText("How was my fee calculated, and how does it relate to actual tax savings?", {exact:true})).toBeHidden();
  await moreQuestions.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("How was my fee calculated, and how does it relate to actual tax savings?", {exact:true})).toBeVisible();
  await page.keyboard.press("Enter");
  await page.locator("#about-records-heading").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("These dated TCAD records may not reflect today’s property or protest status.", {exact:false})).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Separately valued features" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Looks like a successful protest!" }),
  ).toBeVisible();
  const assessmentSummary = page.getByRole("region", {name:"Your certified market value"});
  await expect(assessmentSummary).toContainText("$450,000");
  await expect(assessmentSummary).toContainText("$100,000 lower");
  await expect(assessmentSummary).toContainText("$50,000 higher");
  const protestResult = page.getByRole("region", {name:"Looks like a successful protest!"});
  await expect(protestResult).toContainText("Agent listed for 2026");
  await expect(protestResult).toContainText("FIXTURE TAX PARTNERS");
  await expect(protestResult).toContainText("Recorded: Apr 29, 2026");
  await expect(protestResult).toContainText("do not confirm what caused the reduction");
  const values = page.getByRole("region", {name:"How the values fit together"});
  await expect(values).toContainText("Leander ISD");
  await expect(values).toContainText("before exemptions");
  await expect(values).toContainText("Increase $50,000 (12.5%)");
  await expect(protestResult.locator(".homeowner-result")).toHaveCSS("color", "rgb(25, 122, 101)");
  await expect(values.locator(".overview-change-strong").first()).toHaveCSS("color", "rgb(23, 48, 66)");
  expect((await assessmentSummary.boundingBox())!.y).toBeLessThan((await protestResult.boundingBox())!.y);
  expect((await protestResult.boundingBox())!.y).toBeLessThan((await values.boundingBox())!.y);
  await page.getByRole("link", {name:"See all taxing authorities"}).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#taxing-authorities")).toHaveAttribute("open", "");
  await expect(page.locator("#taxing-authorities summary")).toBeFocused();
  await expect(page.locator("#taxing-authorities table")).toBeVisible();
  await page.locator("#taxing-authorities summary").click();
  await expect(page.getByText("No longer separately listed", {exact:true})).toBeVisible();
  await page.getByText("View all separately valued features", {exact:true}).click();
  await expect(page.getByText("Not listed", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Not listed / not comparable", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Exemptions & taxable values" }),
  ).toBeVisible();
  await expect(page.getByText("FIXTURE TAX PARTNERS", {exact:true}).first()).toBeVisible();
  await page.getByText("View source records", {exact:true}).click();
  await expect(page.getByText("2026 tax year · Apr 29, 2026", {exact:true})).toBeVisible();
  await expect(page.getByText("TCAD status code: EF", {exact:true})).toBeVisible();
  await page.getByText("View source records", {exact:true}).click();
  await page.getByText("View all separately valued features", {exact:true}).click();
  const historyDetails=page.locator("details").filter({has:page.locator("summary",{hasText:"View all assessment values"})});
  await historyDetails.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(historyDetails).toHaveAttribute("open", "");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("link", {name:"Browse my street"})).toHaveCSS("color", "rgb(255, 255, 255)");
  const term = page.getByRole("button", {
    name: "TCAD market value",
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
  await page.getByRole("link", { name: "Browse my street" }).click();
  await expect(page).toHaveURL(/q=N\+OAK\+ST/);
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
  await expect(page.getByRole("region", {name:"Your certified market value"})).toHaveCount(0);
});

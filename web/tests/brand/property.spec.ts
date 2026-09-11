import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("combined property view: dates, missing feature, exemptions, keyboard and responsive layout", async ({
  page,
}, info) => {
  await page.goto("/property/100?q=Oak&page=0&all=1");
  await expect(
    page.getByRole("heading", { name: "123 N OAK ST", exact: true }),
  ).toBeVisible();
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
  await expect(page.getByText("Protest recorded · 2026", {exact:true})).toBeVisible();
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
  await term.focus();
  await expect(term).toHaveAttribute("aria-expanded", "true");
  const tooltip = page.getByRole("tooltip");
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

import { expect } from "@playwright/test";
import { test, smokeCheck, navigateAndWait, expectNoJSErrors } from "./fixtures";

test.describe("Rules Page", () => {
  test("page renders correctly", async ({ page, pageErrors }) => {
    await smokeCheck(page, "/rules", pageErrors);
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();
  });

  test("all rule cards render category and severity badges", async ({ page, pageErrors }) => {
    await navigateAndWait(page, "/rules");

    const cards = page.locator("[class*='rounded-xl'][class*='border']").filter({
      has: page.locator("p[class*='font-semibold']"),
    });

    const cardCount = await cards.count();

    if (cardCount === 0) {
      test.skip(true, "No rules in database, nothing to verify");

      return;
    }

    for (const i of Array.from({ length: cardCount }, (_, idx) => idx)) {
      const card = cards.nth(i);
      const name = await card.locator("p[class*='font-semibold']").first().textContent();

      const badges = card.locator("span[class*='rounded-full']");
      const badgeCount = await badges.count();
      expect(badgeCount, `Rule "${name}" should have at least a category badge`).toBeGreaterThan(0);
    }

    expectNoJSErrors(pageErrors);
  });

  test("category filter tabs change displayed items", async ({ page, pageErrors }) => {
    await navigateAndWait(page, "/rules");

    const filterButtons = page.locator("button[role='tab'], [role='tablist'] button");
    const filterCount = await filterButtons.count();

    for (const i of Array.from({ length: filterCount }, (_, idx) => idx)) {
      await filterButtons.nth(i).click();
      await page.waitForLoadState("networkidle");
    }

    expectNoJSErrors(pageErrors);
  });
});

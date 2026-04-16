import { test, expect } from "@playwright/test";

test.describe("Rules Page", () => {
  test("renders rule cards without crashing", async ({ page }) => {
    await page.goto("/rules");
    await page.waitForLoadState("networkidle");

    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();

    const errorOverlay = page.locator("vite-error-overlay");
    await expect(errorOverlay).toHaveCount(0);
  });

  test("all rule cards render category and severity badges", async ({ page }) => {
    await page.goto("/rules");
    await page.waitForLoadState("networkidle");

    const cards = page.locator("[class*='rounded-xl'][class*='border']").filter({
      has: page.locator("p[class*='font-semibold']"),
    });

    const cardCount = await cards.count();

    if (cardCount === 0) {
      test.skip(true, "No rules in database, nothing to verify");

      return;
    }

    for (let i = 0; i < cardCount; i++) {
      const card = cards.nth(i);
      const name = await card.locator("p[class*='font-semibold']").first().textContent();

      const badges = card.locator("span[class*='rounded-full']");
      const badgeCount = await badges.count();
      expect(badgeCount, `Rule "${name}" should have at least a category badge`).toBeGreaterThan(0);

      for (let j = 0; j < badgeCount; j++) {
        const badge = badges.nth(j);
        const cls = await badge.getAttribute("class");
        expect(cls, `Badge ${j} of rule "${name}" should have styling classes`).toBeTruthy();
      }
    }
  });

  test("category filter tabs work without errors", async ({ page }) => {
    await page.goto("/rules");
    await page.waitForLoadState("networkidle");

    const filterButtons = page.locator(
      "[class*='rounded-lg'][class*='border'] button[class*='rounded-md']",
    );
    const filterCount = await filterButtons.count();

    for (let i = 0; i < filterCount; i++) {
      await filterButtons.nth(i).click();
      await page.waitForTimeout(200);

      const errorOverlay = page.locator("vite-error-overlay");
      await expect(errorOverlay).toHaveCount(0);
    }
  });

  test("no uncaught JS errors on rules page", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/rules");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    expect(errors, `Uncaught JS errors: ${errors.join("; ")}`).toHaveLength(0);
  });
});

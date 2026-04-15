import { test, expect } from "@playwright/test";

test.describe("Best Practices Page", () => {
  test("renders without crashing", async ({ page }) => {
    await page.goto("/best-practices");
    await page.waitForLoadState("networkidle");

    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();

    const errorOverlay = page.locator("vite-error-overlay");
    await expect(errorOverlay).toHaveCount(0);
  });

  test("category filter tabs work without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/best-practices");
    await page.waitForLoadState("networkidle");

    const filterButtons = page.locator(
      "[class*='rounded-lg'][class*='border'] button[class*='rounded-md']",
    );
    const filterCount = await filterButtons.count();

    for (let i = 0; i < filterCount; i++) {
      await filterButtons.nth(i).click();
      await page.waitForTimeout(200);
    }

    expect(errors, `Uncaught JS errors: ${errors.join("; ")}`).toHaveLength(0);
  });

  test("no uncaught JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/best-practices");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    expect(errors, `Uncaught JS errors: ${errors.join("; ")}`).toHaveLength(0);
  });
});

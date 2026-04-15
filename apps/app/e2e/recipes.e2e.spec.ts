import { test, expect } from "@playwright/test";

test.describe("Recipes Page", () => {
  test("renders without crashing", async ({ page }) => {
    await page.goto("/recipes");
    await page.waitForLoadState("networkidle");

    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();

    const errorOverlay = page.locator("vite-error-overlay");
    await expect(errorOverlay).toHaveCount(0);
  });

  test("no uncaught JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/recipes");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    expect(errors, `Uncaught JS errors: ${errors.join("; ")}`).toHaveLength(0);
  });
});

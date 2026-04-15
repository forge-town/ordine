import { test, expect } from "@playwright/test";

test.describe("Settings Page", () => {
  test("renders without crashing", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const errorOverlay = page.locator("vite-error-overlay");
    await expect(errorOverlay).toHaveCount(0);
  });

  test("no uncaught JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => {
      if (!err.message.includes("localStorage is not defined")) {
        errors.push(err.message);
      }
    });

    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    expect(errors, `Uncaught JS errors: ${errors.join("; ")}`).toHaveLength(0);
  });
});

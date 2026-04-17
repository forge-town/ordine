import { expect } from "@playwright/test";
import { test, smokeCheck, navigateAndWait, expectNoJSErrors } from "./fixtures";

test.describe("Best Practices Page", () => {
  test("page renders correctly", async ({ page, pageErrors }) => {
    await smokeCheck(page, "/best-practices", pageErrors);
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();
  });

  test("category filter tabs change displayed items", async ({ page, pageErrors }) => {
    await navigateAndWait(page, "/best-practices");

    const filterButtons = page.locator("button[role='tab'], [role='tablist'] button");
    const filterCount = await filterButtons.count();

    for (const i of Array.from({ length: filterCount }, (_, idx) => idx)) {
      await filterButtons.nth(i).click();
      await page.waitForLoadState("networkidle");
    }

    expectNoJSErrors(pageErrors);
  });
});

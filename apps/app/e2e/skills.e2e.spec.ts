import { expect } from "@playwright/test";
import { test, smokeCheck, navigateAndWait, expectNoJSErrors } from "./fixtures";

test.describe("Skills Page", () => {
  test("page renders correctly", async ({ page, pageErrors }) => {
    await smokeCheck(page, "/skills", pageErrors);
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();
  });

  test("category filter buttons work", async ({ page, pageErrors }) => {
    await navigateAndWait(page, "/skills");

    const filterButtons = page.locator("button[role='tab'], [role='tablist'] button");
    const filterCount = await filterButtons.count();

    for (const i of Array.from({ length: Math.min(filterCount, 10) }, (_, idx) => idx)) {
      await filterButtons.nth(i).click();
      await page.waitForLoadState("networkidle");
    }

    expectNoJSErrors(pageErrors);
  });
});

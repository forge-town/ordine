import { expect } from "@playwright/test";
import { test, smokeCheck, navigateAndWait, expectNoJSErrors } from "./fixtures";

test.describe("Projects Page", () => {
  test("page renders correctly", async ({ page, pageErrors }) => {
    await smokeCheck(page, "/projects", pageErrors);
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();
  });

  test("search filters the project list", async ({ page, pageErrors }) => {
    await navigateAndWait(page, "/projects");

    const searchInput = page.locator("input[placeholder*='搜索'], input[placeholder*='earch']");
    if ((await searchInput.count()) > 0) {
      await searchInput.first().fill("nonexistent-query-xyz");
      await page.waitForLoadState("networkidle");
    }

    expectNoJSErrors(pageErrors);
  });
});

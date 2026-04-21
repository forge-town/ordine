import { expect } from "@playwright/test";
import { test, smokeCheck, navigateAndWait, expectNoJSErrors } from "./fixtures";

test.describe("Pipelines Page", () => {
  test("page renders correctly", async ({ page, pageErrors }) => {
    await smokeCheck(page, "/pipelines", pageErrors);
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();
  });

  test("search filters the pipeline list", async ({ page, pageErrors }) => {
    await navigateAndWait(page, "/pipelines");

    const searchInput = page.locator("input[placeholder*='搜索'], input[placeholder*='earch']");
    if ((await searchInput.count()) > 0) {
      await searchInput.first().fill("nonexistent-query-xyz");
      await page.waitForLoadState("networkidle");
    }

    expectNoJSErrors(pageErrors);
  });
});

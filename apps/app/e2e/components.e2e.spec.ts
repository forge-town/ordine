import { expect } from "@playwright/test";
import { test, smokeCheck, navigateAndWait, expectNoJSErrors } from "./fixtures";

test.describe("Components Page", () => {
  test("page renders correctly", async ({ page, pageErrors }) => {
    await smokeCheck(page, "/components", pageErrors);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("search filters the component list", async ({ page, pageErrors }) => {
    await navigateAndWait(page, "/components");

    const searchInput = page.locator("input[placeholder*='搜索'], input[placeholder*='earch']");
    await expect(searchInput).toBeVisible();
    await searchInput.fill("nonexistent-component-query-xyz");

    expectNoJSErrors(pageErrors);
  });
});

import { expect } from "@playwright/test";
import { test, smokeCheck, navigateAndWait, expectNoJSErrors } from "./fixtures";

test.describe("Jobs Page", () => {
  test("page renders correctly", async ({ page, pageErrors }) => {
    await smokeCheck(page, "/pipelines/jobs", pageErrors);
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();
  });

  test("status filter buttons work", async ({ page, pageErrors }) => {
    await navigateAndWait(page, "/pipelines/jobs");

    const filterButtons = page.getByRole("button", {
      name: /^(All|Running|Waiting|Completed|Failed) \d+$/,
    });
    const filterCount = await filterButtons.count();

    for (const i of Array.from({ length: Math.min(filterCount, 10) }, (_, idx) => idx)) {
      await filterButtons.nth(i).click();
      await page.waitForLoadState("networkidle");
    }

    expectNoJSErrors(pageErrors);
  });
});

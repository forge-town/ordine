import { expect } from "@playwright/test";
import { test, navigateAndWait, expectNoJSErrors } from "./fixtures";

test.describe("Pipeline workflow", () => {
  test("creates a Pipeline, renames it, and keeps it after reload", async ({
    page,
    pageErrors,
  }, testInfo) => {
    const runId = `${Date.now()}-${testInfo.workerIndex}-${testInfo.repeatEachIndex}`;
    const name = `Pipeline E2E ${runId}`;

    await navigateAndWait(page, "/pipelines");
    await page.locator("main").getByRole("button", { name: "New Pipeline" }).click();
    await expect(page).toHaveURL(/\/canvas\?id=pipeline-/);
    await page
      .getByTestId("canvas-v2-top-pill")
      .getByRole("button", { name: "New Pipeline" })
      .click();
    await page.getByTestId("canvas-v2-rename-input").fill(name);
    await page.getByTestId("canvas-v2-rename-input").press("Enter");

    await expect(
      page.getByTestId("canvas-v2-top-pill").getByText(name, { exact: true }),
    ).toBeVisible();
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByTestId("canvas-v2-top-pill").getByText(name, { exact: true }),
    ).toBeVisible();

    await navigateAndWait(page, "/pipelines");
    await page.getByPlaceholder("Search").fill(name);
    await expect(page.getByText(name, { exact: true })).toBeVisible();
    expectNoJSErrors(pageErrors);
  });
});

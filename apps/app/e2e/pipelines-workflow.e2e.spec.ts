import { expect } from "@playwright/test";
import {
  test,
  navigateAndWait,
  expectCanvasTitle,
  expectNoJSErrors,
  renameCanvasPipeline,
} from "./fixtures";

test.describe("Pipeline workflow", () => {
  test("creates a Pipeline, renames it, and keeps it after reload", async ({
    page,
    pageErrors,
  }, testInfo) => {
    const runId = `${Date.now()}-${testInfo.workerIndex}-${testInfo.repeatEachIndex}`;
    const name = `Pipeline E2E ${runId}`;

    await navigateAndWait(page, "/pipelines");
    await page.locator("main").getByRole("button", { name: "New Pipeline", exact: true }).click();
    await expect(page).toHaveURL(/\/canvas\?id=pipeline-/);
    await renameCanvasPipeline(page, name);
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expectCanvasTitle(page, name);

    await navigateAndWait(page, "/pipelines");
    await page.getByPlaceholder("Search").fill(name);
    await expect(page.getByText(name, { exact: true })).toBeVisible();
    expectNoJSErrors(pageErrors);
  });
});

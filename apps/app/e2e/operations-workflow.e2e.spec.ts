import { expect } from "@playwright/test";
import { test, navigateAndWait, expectNoJSErrors } from "./fixtures";

test.describe("Operation workflow", () => {
  // Regression: ISSUE-OPERATION-001 — detail showed stale values after a successful edit.
  // Found by /qa on 2026-08-11.
  // Report: .gstack/qa-reports/qa-report-localhost-9460-2026-08-11.md
  test("creates and edits a Script Operation without requiring reload", async ({
    page,
    pageErrors,
  }, testInfo) => {
    const runId = `${Date.now()}-${testInfo.workerIndex}-${testInfo.repeatEachIndex}`;
    const name = `Operation E2E ${runId}`;
    const initialDescription = `Initial operation ${runId}`;
    const updatedDescription = `Updated operation ${runId}`;
    const updatedCommand = `printf operation-updated-${runId}`;

    await navigateAndWait(page, "/pipelines/operations");
    await page.getByRole("button", { name: "New Operation" }).first().click();
    await page.getByPlaceholder("e.g. Run ESLint").fill(name);
    await page
      .getByPlaceholder("Briefly describe what this operation does")
      .fill(initialDescription);
    await page.getByRole("button", { name: "Script Execute a shell script" }).click();
    await page.getByPlaceholder("e.g. eslint src/ --fix").fill(`printf operation-${runId}`);
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page).toHaveURL(/\/pipelines\/operations\/[^/]+$/);
    await expect(page.getByText(initialDescription, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page
      .getByPlaceholder("Briefly describe what this operation does")
      .fill(updatedDescription);
    await page.getByPlaceholder("e.g. eslint src/ --fix").fill(updatedCommand);
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page).toHaveURL(/\/pipelines\/operations\/[^/]+$/);
    await expect(page.getByText(updatedDescription, { exact: true })).toBeVisible();
    await expect(page.getByText(updatedCommand, { exact: true })).toBeVisible();
    expectNoJSErrors(pageErrors);
  });
});

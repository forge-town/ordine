import { expect } from "@playwright/test";
import { test, expectNoJSErrors, navigateAndWait } from "./fixtures";

test.describe("Routine workflow", () => {
  test("creates, validates, edits, persists, and deletes a Pipeline schedule", async ({
    page,
    pageErrors,
  }, testInfo) => {
    const runId = `${Date.now()}-${testInfo.workerIndex}-${testInfo.repeatEachIndex}`;
    const pipelineName = `Routine Pipeline ${runId}`;

    await navigateAndWait(page, "/pipelines");
    await page.locator("main").getByRole("button", { name: "New Pipeline" }).click();
    await expect(page).toHaveURL(/\/canvas\?id=pipeline-/);
    const pipelineId = new URL(page.url()).searchParams.get("id");
    expect(pipelineId).toBeTruthy();
    await page.getByTestId("canvas-v2-crumb-0").click();
    await page.getByTestId("canvas-v2-rename-input").fill(pipelineName);
    await page.getByTestId("canvas-v2-rename-input").press("Enter");
    await expect(page.getByTestId("canvas-v2-top-pill")).toContainText(pipelineName);

    await navigateAndWait(page, "/pipelines");
    await page.getByRole("button", { name: `Schedule ${pipelineName}` }).click();
    const editor = page.getByTestId("schedule-editor");
    await expect(editor).toBeVisible();

    await editor.getByTestId("schedule-cron-minute").fill("99");
    await editor.getByTestId("schedule-save").click();
    await expect(editor.getByRole("alert")).toHaveText(
      "Enter a valid five-field Cron expression",
    );

    await editor.getByTestId("schedule-preset-daily").click();
    await editor.getByTestId("schedule-save").click();
    await expect(editor).toHaveCount(0);

    await navigateAndWait(page, "/pipelines/jobs");
    await page.getByRole("button", { name: "New Routine" }).click();
    await page.getByTestId(`jobs-pick-${pipelineId}`).click();
    await expect(editor).toBeVisible();
    await expect(editor.getByTestId("schedule-cron-minute")).toHaveValue("0");
    await expect(editor.getByTestId("schedule-cron-hour")).toHaveValue("6");

    await editor.getByTestId("schedule-preset-weekdays").click();
    await editor.getByTestId("schedule-enabled-toggle").click();
    await editor.getByTestId("schedule-save").click();
    await expect(editor).toHaveCount(0);

    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "New Routine" }).click();
    await page.getByTestId(`jobs-pick-${pipelineId}`).click();
    await expect(editor.getByTestId("schedule-enabled-toggle")).toHaveAttribute(
      "aria-checked",
      "false",
    );
    await expect(editor.getByTestId("schedule-cron-hour")).toHaveValue("9");
    await expect(editor.getByTestId("schedule-cron-weekday")).toHaveValue("1-5");

    await editor.getByTestId("schedule-delete").click();
    await expect(editor).toHaveCount(0);
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "New Routine" }).click();
    await page.getByTestId(`jobs-pick-${pipelineId}`).click();
    await expect(editor.getByTestId("schedule-routine-select")).toHaveCount(0);
    expectNoJSErrors(pageErrors);
  });
});

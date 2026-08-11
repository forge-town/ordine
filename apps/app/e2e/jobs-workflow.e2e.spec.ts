import { expect } from "@playwright/test";
import { test, expectNoJSErrors, navigateAndWait } from "./fixtures";

test.describe("Job execution workflow", () => {
  test("runs a Script Operation Pipeline and reopens the persisted Job", async ({
    page,
    pageErrors,
  }, testInfo) => {
    test.setTimeout(60_000);
    const runId = `${Date.now()}-${testInfo.workerIndex}-${testInfo.repeatEachIndex}`;
    const operationName = `Job Operation ${runId}`;
    const pipelineName = `Job Pipeline ${runId}`;

    await navigateAndWait(page, "/pipelines/operations");
    await page.getByRole("button", { name: "New Operation" }).first().click();
    await page.getByPlaceholder("e.g. Run ESLint").fill(operationName);
    await page
      .getByPlaceholder("Briefly describe what this operation does")
      .fill("Produces deterministic output for the Job workflow");
    await page.getByRole("button", { name: "Script Execute a shell script" }).click();
    await page.getByPlaceholder("e.g. eslint src/ --fix").fill(`printf job-${runId}`);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(/\/pipelines\/operations\/op-[^/?]+$/);
    const operationId = page.url().split("/").at(-1);
    expect(operationId).toBeTruthy();

    await navigateAndWait(page, "/pipelines");
    await page.locator("main").getByRole("button", { name: "New Pipeline" }).click();
    await expect(page).toHaveURL(/\/canvas\?id=pipeline-/);
    const pipelineId = new URL(page.url()).searchParams.get("id");
    expect(pipelineId).toBeTruthy();
    await page.getByTestId("canvas-v2-crumb-0").click();
    await page.getByTestId("canvas-v2-rename-input").fill(pipelineName);
    await page.getByTestId("canvas-v2-rename-input").press("Enter");

    await page.getByTestId("canvas-v2-components-toggle").click();
    const operationEntry = page.getByTestId(`canvas-v2-component-operation-${operationId}`);
    await expect(operationEntry).toBeVisible();
    await operationEntry.dragTo(page.getByTestId("canvas-v2-flow"), {
      targetPosition: { x: 620, y: 320 },
    });
    await expect(page.locator(".react-flow__node-operation")).toHaveCount(1);

    await page.getByTestId("canvas-v2-version-menu-trigger").click();
    await page.getByTestId("canvas-v2-version-overwrite").click();
    await expect(page.getByText("Saved over v1")).toBeVisible();
    await expect(page.getByTestId("canvas-v2-run")).toBeEnabled();
    await page.getByTestId("canvas-v2-run").click();
    const runConsole = page.getByTestId("canvas-v2-run-console");
    await expect(runConsole).toBeVisible();
    await expect(runConsole).toContainText(/done/, { timeout: 30_000 });
    await expect(runConsole).toContainText("Script output (21 chars)");

    await navigateAndWait(page, "/pipelines/jobs");
    await page.getByPlaceholder("Search jobs…").fill(pipelineName);
    const row = page.getByTestId(/^jobs-table-row-/).filter({ hasText: pipelineName });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("Done");
    await row.getByRole("button").first().click();
    const drawer = page.getByTestId("job-detail-drawer");
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText(pipelineName);
    await expect(drawer).toContainText("Script output (21 chars)");
    await drawer.getByTestId("job-drawer-open-canvas").click();
    await expect(page).toHaveURL(new RegExp(`/canvas\\?id=${pipelineId}$`));
    await expect(page.getByTestId("canvas-v2-top-pill")).toContainText(pipelineName);
    expectNoJSErrors(pageErrors);
  });
});

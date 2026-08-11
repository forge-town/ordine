import { expect, type Page } from "@playwright/test";
import { test, navigateAndWait, expectNoJSErrors } from "./fixtures";

const createProject = async (page: Page, name: string) => {
  await page.getByRole("button", { name: "Projects" }).click();
  await page.getByRole("menuitem", { name: "New project" }).click();
  await page.getByRole("textbox", { name: "Project name" }).fill(name);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByRole("button", { name: "Projects" })).toContainText(name);
};

const createAndRenamePipeline = async (page: Page, name: string) => {
  await navigateAndWait(page, "/pipelines");
  await page.locator("main").getByRole("button", { name: "New Pipeline" }).click();
  await expect(page).toHaveURL(/\/canvas\?id=pipeline-/);
  await page.getByTestId("canvas-v2-crumb-0").click();
  await page.getByTestId("canvas-v2-rename-input").fill(name);
  await page.getByTestId("canvas-v2-rename-input").press("Enter");
  await expect(page.getByTestId("canvas-v2-top-pill")).toContainText(name);
};

test.describe("Project-scoped Pipeline workflow", () => {
  test("keeps Pipeline ownership and filtering across project switches and reload", async ({
    page,
    pageErrors,
  }, testInfo) => {
    const runId = `${Date.now()}-${testInfo.workerIndex}-${testInfo.repeatEachIndex}`;
    const projectA = `Project Alpha ${runId}`;
    const projectB = `Project Beta ${runId}`;
    const pipelineA = `Pipeline Alpha ${runId}`;
    const pipelineB = `Pipeline Beta ${runId}`;

    await navigateAndWait(page, "/");
    await createProject(page, projectA);
    await createAndRenamePipeline(page, pipelineA);

    await navigateAndWait(page, "/");
    await createProject(page, projectB);
    await createAndRenamePipeline(page, pipelineB);

    await navigateAndWait(page, "/pipelines");
    await expect(page.getByText(pipelineB, { exact: true })).toBeVisible();
    await expect(page.getByText(pipelineA, { exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "Projects" }).click();
    await page.getByRole("menuitem", { name: projectA }).click();
    await expect(page.getByText(pipelineA, { exact: true })).toBeVisible();
    await expect(page.getByText(pipelineB, { exact: true })).toHaveCount(0);

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: "Projects" })).toContainText(projectA);
    await expect(page.getByText(pipelineA, { exact: true })).toBeVisible();
    await expect(page.getByText(pipelineB, { exact: true })).toHaveCount(0);
    expectNoJSErrors(pageErrors);
  });
});

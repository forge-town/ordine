import { expect } from "@playwright/test";
import { test, navigateAndWait, expectNoJSErrors } from "./fixtures";

test.describe("Pipeline CRUD", () => {
  test("deletes the pipeline created by this test", async ({ page, pageErrors }, testInfo) => {
    const pipelineId = `crud-pipeline-${Date.now()}-${testInfo.workerIndex}`;
    const pipelineName = `CRUD delete ${pipelineId}`;

    await navigateAndWait(page, "/pipelines");
    const createResponse = await page.request.post("/api/trpc/pipelines.create?batch=1", {
      data: {
        0: {
          json: {
            pipeline: {
              id: pipelineId,
              name: pipelineName,
              description: "Pipeline CRUD E2E fixture",
              sharedContext: "",
              tags: ["e2e"],
              timeoutMs: null,
              status: "draft",
              version: 1,
              nodes: [],
              edges: [],
            },
          },
        },
      },
    });
    expect(createResponse.ok()).toBe(true);

    await page.reload();
    await page.waitForLoadState("domcontentloaded");
    const card = page.locator('[data-slot="card"]').filter({ hasText: pipelineName });
    await expect(card).toHaveCount(1);
    const deleteButton = card.getByRole("button", { name: /^Delete /i });
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();

    await expect(card).toHaveCount(0);
    await page.reload();
    await expect(page.locator('[data-slot="card"]').filter({ hasText: pipelineName })).toHaveCount(
      0,
    );
    expectNoJSErrors(pageErrors);
  });
});

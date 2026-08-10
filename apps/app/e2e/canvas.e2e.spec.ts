import { expect, type Page } from "@playwright/test";
import { test, navigateAndWait, expectNoJSErrors } from "./fixtures";

const openCanvasPage = async (page: Page) => {
  await navigateAndWait(page, "/pipelines");
  const pipelineId = `pipeline-e2e-${Date.now()}`;
  const createResponse = await page.request.post("/api/trpc/pipelines.create?batch=1", {
    data: {
      0: {
        json: {
          pipeline: {
            id: pipelineId,
            name: "Canvas E2E Pipeline",
            description: "",
            sharedContext: "",
            tags: ["e2e"],
            timeoutMs: null,
            nodes: [],
            edges: [],
          },
        },
      },
    },
  });
  expect(createResponse.ok()).toBe(true);

  await navigateAndWait(page, `/canvas?id=${pipelineId}`);
};

test.describe("Canvas editor", () => {
  test("supports the current canvas component workflow", async ({ page, pageErrors }) => {
    await openCanvasPage(page);

    await expect(page.getByTestId("canvas-v2-root")).toBeVisible();
    await expect(page.getByTestId("canvas-v2-flow")).toBeVisible();
    await expect(page.getByTestId("canvas-v2-toolbar")).toBeVisible();
    await expect(page.getByTestId("canvas-v2-top-pill")).toBeVisible();

    await page.getByTestId("canvas-v2-components-toggle").click();
    await expect(page.getByTestId("canvas-v2-components-panel")).toBeVisible();

    const fileButton = page.getByTestId("canvas-v2-component-object-file");
    await expect(fileButton).toBeVisible();

    await fileButton.click();
    await expect(page.getByTestId("canvas-v2-node-card").first()).toBeVisible();

    expectNoJSErrors(pageErrors);
  });
});

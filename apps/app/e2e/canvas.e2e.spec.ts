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

    await expect(page.getByTestId("canvas-langflow-shell")).toBeVisible();
    await expect(page.getByTestId("canvas-flow-viewport")).toBeVisible();
    await expect(page.getByTestId("canvas-toolbar")).toBeVisible();
    await expect(page.getByTestId("canvas-top-chrome")).toBeVisible();
    await expect(page.getByTestId("canvas-component-panel")).toBeVisible();
    await expect(page.getByTestId("canvas-agent-panel")).toBeVisible();

    const folderButton = page.getByRole("button", {
      name: /(?:Folder Folder|文件夹 文件夹)/,
    });
    await expect(folderButton).toBeVisible();

    await folderButton.click();
    await expect(
      page.getByTestId("canvas-flow-viewport").locator(".react-flow__node").first(),
    ).toBeVisible();

    expectNoJSErrors(pageErrors);
  });
});

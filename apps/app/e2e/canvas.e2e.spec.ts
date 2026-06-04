import { expect, type Page } from "@playwright/test";
import { test, navigateAndWait, expectNoJSErrors } from "./fixtures";

const openCanvasPage = async (page: Page) => {
  await navigateAndWait(page, "/pipelines");

  const firstCanvasLink = page.locator("a[href*='/canvas?id=']").first();
  if ((await firstCanvasLink.count()) > 0) {
    await firstCanvasLink.click();
    await page.waitForURL(/\/canvas\?id=/);
    await page.waitForLoadState("networkidle");

    return;
  }

  const createButton = page.locator("button:has(svg.lucide-plus)").first();
  if ((await createButton.count()) === 0) {
    test.skip(true, "No saved pipeline link or create button found");

    return;
  }

  await createButton.click();
  await page.waitForURL(/\/canvas\?id=/);
  await page.waitForLoadState("networkidle");
};

test.describe("Canvas editor", () => {
  test("supports the LangFlow shell workflow", async ({ page, pageErrors }) => {
    await openCanvasPage(page);

    await expect(page.getByTestId("canvas-mini-sidebar")).toBeVisible();
    await expect(page.getByTestId("canvas-component-panel")).toBeVisible();
    await expect(page.getByTestId("canvas-flow-viewport")).toBeVisible();
    await expect(page.getByTestId("canvas-status-bar")).toContainText(/\d+/);

    await page.keyboard.press("/");
    const searchInput = page.getByRole("textbox", { name: /Search components/i });
    await expect(searchInput).toBeFocused();
    await searchInput.fill("file");

    const fileButton = page
      .getByTestId("canvas-component-panel")
      .getByRole("button", { name: /File/i })
      .first();
    if ((await fileButton.count()) === 0) {
      test.skip(true, "File component entry not found");

      return;
    }

    await fileButton.click();
    const firstNode = page.locator(".react-flow__node").first();
    await expect(firstNode).toBeVisible();
    await expect(page.locator("[data-card-mode='compact']").first()).toBeVisible();

    await firstNode.click();
    await expect(page.getByTestId("canvas-properties-panel")).toBeVisible();

    await page.getByRole("button", { name: /Workspace/i }).click();
    await expect(page.getByTestId("canvas-workspace-sidebar-overlay")).toBeVisible();

    expectNoJSErrors(pageErrors);
  });
});

import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { expect, type Page, type TestInfo } from "@playwright/test";
import { expectNoErrorOverlay, expectNoJSErrors, navigateAndWait, test } from "./fixtures";

const mockAgentControlBootstrap = async (page: Page) => {
  await page.route("**/api/agent-threads**", async (route) => {
    const url = new URL(route.request().url());
    const headers = { "content-type": "application/json" };
    if (url.pathname.endsWith("/agent-threads/capabilities")) {
      await route.fulfill({
        body: JSON.stringify({
          enabled: true,
          toolContractVersion: 1,
          toolCount: 22,
          runtimes: [
            {
              runtimeConfigId: "local-codex",
              runtime: "codex",
              name: "Codex",
              supported: true,
              reason: "Verified MCP-only control mode",
              controlModel: "gpt-5.6-luna",
              controlReasoningEffort: "xhigh",
            },
          ],
        }),
        headers,
        status: 200,
      });

      return;
    }
    if (url.pathname.endsWith("/agent-threads") && route.request().method() === "GET") {
      await route.fulfill({ body: "[]", headers, status: 200 });

      return;
    }
    await route.fallback();
  });
};

const attachScreenshot = async (page: Page, testInfo: TestInfo, name: string) => {
  const visualDir = process.env.AGENT_CONTROL_VISUAL_DIR;
  if (visualDir) {
    await mkdir(visualDir, { recursive: true });
    const screenshotPath = join(visualDir, `${name}.png`);
    await page.screenshot({ animations: "disabled", fullPage: true, path: screenshotPath });
    await testInfo.attach(name, { contentType: "image/png", path: screenshotPath });

    return;
  }
  await testInfo.attach(name, {
    body: await page.screenshot({ animations: "disabled", fullPage: true }),
    contentType: "image/png",
  });
};

test.describe("ORDINE Agent Control Plane", () => {
  test.beforeEach(async ({ page }) => {
    await mockAgentControlBootstrap(page);
  });

  test("keeps the global composer and thread state across application routes", async ({
    page,
    pageErrors,
  }, testInfo) => {
    await page.setViewportSize({ height: 900, width: 1440 });
    await navigateAndWait(page, "/pipelines");

    const bar = page.getByTestId("global-agent-bar");
    const composer = bar.getByTestId("agent-composer-input");
    await expect(bar).toBeVisible();
    await expect(composer).toBeEnabled();
    await composer.fill("Inspect this page without a Canvas snapshot");

    await bar.getByTestId("agent-surface-open").click();
    await expect(page.getByTestId("global-agent-panel")).toBeVisible();
    await expect(page.getByText("22 controlled tools", { exact: true })).toBeVisible();
    await expect(page.getByText("Control ORDINE step by step", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await expect(page.getByTestId("global-agent-panel")).toBeHidden();

    await page.getByRole("link", { name: "Settings" }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(
      page.getByTestId("global-agent-bar").getByTestId("agent-composer-input"),
    ).toHaveValue("Inspect this page without a Canvas snapshot");

    await expectNoErrorOverlay(page);
    expectNoJSErrors(pageErrors);
    await attachScreenshot(page, testInfo, "global-agent-bar-desktop");
  });

  test("reuses the Agent panel on Canvas and respects responsive reduced-motion layout", async ({
    page,
    pageErrors,
  }, testInfo) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ height: 900, width: 1440 });
    await navigateAndWait(page, "/canvas");

    const bar = page.getByTestId("global-agent-bar");
    const canvasPanel = page.getByTestId("canvas-agent-panel-shell");
    await expect(bar).toBeHidden();
    await expect(bar.getByRole("textbox")).toHaveCount(0);
    await expect(canvasPanel.getByTestId("global-agent-panel")).toBeVisible();
    await expect(
      canvasPanel.getByText("Control ORDINE step by step", { exact: true }),
    ).toBeVisible();

    const transitionProperty = await bar.evaluate(
      (element) => getComputedStyle(element).transitionProperty,
    );
    expect(transitionProperty).toBe("none");
    await attachScreenshot(page, testInfo, "canvas-agent-panel-desktop");

    await page.setViewportSize({ height: 844, width: 390 });
    await expect(canvasPanel).toBeVisible();
    const panelBox = await canvasPanel.boundingBox();
    expect(panelBox).not.toBeNull();
    expect(panelBox?.width ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(390);
    await attachScreenshot(page, testInfo, "canvas-agent-panel-mobile");

    await expectNoErrorOverlay(page);
    expectNoJSErrors(pageErrors);
  });
});

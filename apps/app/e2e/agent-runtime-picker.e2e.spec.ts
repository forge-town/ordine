import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { expect } from "@playwright/test";
import { expectNoJSErrors, navigateAndWait, test } from "./fixtures";

const evidenceDirectory = resolve(import.meta.dirname, "../../../.artifacts/cod-369-ui-20260823");

const expectNoHorizontalOverflow = async (page: Parameters<typeof navigateAndWait>[0]) => {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
};

test.describe("COD-369 local agent selection", () => {
  test.beforeAll(async () => {
    await mkdir(evidenceDirectory, { recursive: true });
  });

  test("selects a CLI and custom model, then restores focus and preference", async ({
    page,
    pageErrors,
  }, testInfo) => {
    const customModel = `gpt-5.4-ordine-acceptance-${testInfo.retry}-${Date.now()}`;
    const serverErrors: string[] = [];
    page.on("response", (response) => {
      if (response.status() >= 500) serverErrors.push(`${response.status()} ${response.url()}`);
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await navigateAndWait(page, "/");

    const executionTrigger = page.getByTestId("agent-execution-picker-trigger");
    await expect(executionTrigger).toBeVisible({ timeout: 30_000 });
    await executionTrigger.click();
    await expect(page.getByTestId("agent-execution-runtime-codex")).toBeVisible();
    await expect(page.getByTestId("agent-execution-runtime-claude-code")).toBeVisible();
    await expect(page.getByTestId("agent-execution-runtime-opencode")).toBeVisible();
    await page.getByTestId("agent-execution-runtime-codex").click();

    const modelTrigger = page.getByTestId("agent-execution-model-trigger");
    await modelTrigger.click();
    const modelSearch = page.getByTestId("agent-execution-model-search");
    await expect(modelSearch).toBeFocused();
    await modelSearch.fill(customModel);
    await page.getByTestId("agent-execution-custom-model").click();
    await expect(modelTrigger).toContainText(customModel);

    await modelTrigger.click();
    await expect(modelSearch).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(modelTrigger).toBeFocused();
    await page.screenshot({
      animations: "disabled",
      fullPage: true,
      path: join(evidenceDirectory, "home-desktop-light.png"),
    });

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(executionTrigger).toContainText("Codex", { timeout: 30_000 });
    await expect(executionTrigger).toContainText(customModel, { timeout: 30_000 });
    await expectNoHorizontalOverflow(page);
    expect(serverErrors, serverErrors.join("\n")).toEqual([]);
    expectNoJSErrors(pageErrors);
  });

  test("keeps the picker usable on a dark mobile viewport", async ({ page, pageErrors }) => {
    await navigateAndWait(page, "/settings");
    await page.getByTestId("settings-appearance-dark").click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.getByRole("button", { name: "New Pipeline" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.setViewportSize({ width: 390, height: 844 });

    const executionTrigger = page.getByTestId("agent-execution-picker-trigger");
    await executionTrigger.click();
    const popover = page.getByTestId("agent-execution-picker-popover");
    await expect(popover).toBeVisible();
    const box = await popover.boundingBox();
    if (!box) throw new Error("Execution picker popover has no layout box");
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(844);
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      animations: "disabled",
      fullPage: true,
      path: join(evidenceDirectory, "home-mobile-dark.png"),
    });
    expectNoJSErrors(pageErrors);
  });

  test("shows connection-test evidence layers before spending quota", async ({
    page,
    pageErrors,
  }) => {
    await page.setViewportSize({ width: 768, height: 900 });
    await navigateAndWait(page, "/runtimes");
    const connectionTest = page.getByRole("button", { name: "Connection test" }).first();
    await expect(connectionTest).toBeVisible({ timeout: 30_000 });
    await connectionTest.click();

    const sheet = page.getByRole("dialog");
    await expect(sheet).toContainText("may consume provider quota");
    await expect(sheet).toContainText("Detected");
    await expect(sheet).toContainText("Command launched");
    await expect(sheet).toContainText("Model call succeeded");
    await expect(sheet.getByRole("button", { name: "Run connection test" })).toBeEnabled();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      animations: "disabled",
      fullPage: true,
      path: join(evidenceDirectory, "runtimes-tablet-connection-test.png"),
    });
    expectNoJSErrors(pageErrors);
  });
});

import { expect } from "@playwright/test";
import { test, navigateAndWait, expectNoJSErrors } from "./fixtures";

test.describe("Local Agent runtime workflow", () => {
  test("scans installed runtimes, syncs them, and keeps them after reload", async ({
    page,
    pageErrors,
  }) => {
    await navigateAndWait(page, "/local-agents");
    await page.getByRole("button", { name: "Re-scan" }).click();

    const dialog = page.getByRole("dialog", { name: "Runtime scan results" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("claude-code", { exact: true })).toBeVisible();
    await expect(dialog.getByText("codex", { exact: true })).toBeVisible();
    await expect(dialog.getByText("hermes", { exact: true })).toBeVisible();
    const syncButton = dialog.getByRole("button", { name: "Sync changes" });
    if (await syncButton.isVisible()) {
      await syncButton.click();
    } else {
      await expect(dialog.getByText("No runtime changes detected.")).toBeVisible();
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    }

    await expect(dialog).toHaveCount(0);
    const detectedSummary = page.getByText(/\d+ of \d+ supported Local Agents are synced\./);
    await expect(detectedSummary).toBeVisible();
    const hermesCard = page
      .locator("article")
      .filter({ has: page.getByText("hermes", { exact: true }) });
    await expect(hermesCard).toBeVisible();
    await expect(hermesCard.getByText("Detected", { exact: true })).toBeVisible();
    await expect(hermesCard.locator('a[href="/runtimes/local-hermes"]')).toBeVisible();
    await expect(page.getByText("Connected", { exact: true })).toHaveCount(0);
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(detectedSummary).toBeVisible();
    await expect(hermesCard).toBeVisible();
    await page.setViewportSize({ width: 701, height: 820 });
    await expect(page.getByRole("heading", { name: "Local Agents" })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= globalThis.innerWidth),
    ).toBe(true);
    expectNoJSErrors(pageErrors);
  });
});

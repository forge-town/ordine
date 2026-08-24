import { expect } from "@playwright/test";
import { test, navigateAndWait, expectNoJSErrors } from "./fixtures";

test.describe("Local Agent runtime workflow", () => {
  test("scans installed runtimes, syncs them, and keeps them after reload", async ({
    page,
    pageErrors,
  }) => {
    await navigateAndWait(page, "/local-agents");
    const rescanButton = page.getByRole("button", { name: "Re-scan" });
    await Promise.all([
      page.waitForResponse(
        (response) => response.url().includes("agentRuntimes.rescanCatalog") && response.ok(),
      ),
      rescanButton.click(),
    ]);
    await expect(rescanButton).toBeEnabled();
    const detectedSummary = page.getByText(/\d+ of \d+ supported Local Agents are synced\./);
    await expect(detectedSummary).toBeVisible();
    const codexCard = page
      .locator("article")
      .filter({ has: page.getByText("Codex CLI", { exact: true }) });
    await expect(codexCard).toBeVisible();
    await expect(codexCard.getByText("Launchable", { exact: true })).toBeVisible();
    await expect(codexCard.locator('a[href="/runtimes/local-codex"]')).toBeVisible();
    await expect(page.getByText("Connected", { exact: true })).toHaveCount(0);
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(detectedSummary).toBeVisible();
    await expect(codexCard).toBeVisible();
    await page.setViewportSize({ width: 701, height: 820 });
    await expect(page.getByRole("heading", { name: "Local Agents" })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= globalThis.innerWidth),
    ).toBe(true);
    expectNoJSErrors(pageErrors);
  });
});

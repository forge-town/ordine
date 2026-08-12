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
    const detectedSummary = page.getByText(/Auto-detected \d+ of 5 agent runtimes on localhost\./);
    await expect(detectedSummary).toBeVisible();
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(detectedSummary).toBeVisible();
    expectNoJSErrors(pageErrors);
  });
});

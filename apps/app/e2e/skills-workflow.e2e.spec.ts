import { expect } from "@playwright/test";
import { test, navigateAndWait, expectNoJSErrors } from "./fixtures";

test.describe("Skill workflow", () => {
  // Regression: ISSUE-SKILL-001 — creating a Skill omitted its required id and returned 400.
  // Found by /qa on 2026-08-11.
  // Report: .gstack/qa-reports/qa-report-localhost-9460-2026-08-11.md
  test("creates a custom Skill and keeps it after reload", async ({ page, pageErrors }, testInfo) => {
    const runId = `${Date.now()}-${testInfo.workerIndex}-${testInfo.repeatEachIndex}`;
    const name = `skill-e2e-${runId}`;
    const label = `Skill E2E ${runId}`;

    await navigateAndWait(page, "/skills");
    await page.getByRole("button", { name: "Create skill" }).click();
    await page.getByRole("textbox", { name: "Name" }).fill(name);
    await page.getByRole("textbox", { name: "Label" }).fill(label);
    await page
      .getByRole("textbox", { name: "Description" })
      .fill("Created through the real Skill form");
    await page.getByRole("button", { name: "Create", exact: true }).click();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByPlaceholder("Search skills...").fill(name);
    await expect(page.getByText(label, { exact: true })).toBeVisible();

    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.getByPlaceholder("Search skills...").fill(name);
    await expect(page.getByText(label, { exact: true })).toBeVisible();
    expectNoJSErrors(pageErrors);
  });
});

import { expect } from "@playwright/test";
import { test, navigateAndWait, expectNoJSErrors } from "./fixtures";

test.describe("Agent workflow", () => {
  // Regression: ISSUE-AGENT-001 — the Agent detail edit button had no action.
  // Found by /qa on 2026-08-11.
  // Report: .gstack/qa-reports/qa-report-localhost-9460-2026-08-11.md
  test("creates an Agent and edits it from the detail page", async ({
    page,
    pageErrors,
  }, testInfo) => {
    const runId = `${Date.now()}-${testInfo.workerIndex}-${testInfo.repeatEachIndex}`;
    const name = `Agent E2E ${runId}`;
    const updatedDescription = `Updated Agent ${runId}`;
    const updatedPrompt = `Verify every output for ${runId}.`;

    await navigateAndWait(page, "/agents");
    await page.getByRole("button", { name: "Create Agent" }).click();
    await page.getByPlaceholder("Enter agent name").fill(name);
    await page.getByPlaceholder("Describe what this agent does").fill("Initial Agent");
    await page.getByRole("button", { name: "Codex OpenAI Codex CLI" }).click();
    await page.getByPlaceholder("Enter system prompt for this agent").fill("Initial system prompt");
    await page.getByPlaceholder("Comma-separated tags").fill("qa, initial");
    await page.getByRole("button", { name: "Create", exact: true }).click();

    await page.getByText(name, { exact: true }).click();
    await expect(page).toHaveURL(/\/agents\/[^/]+$/);
    await page.getByRole("button", { name: "Edit Agent" }).click();
    await page.getByPlaceholder("Describe what this agent does").fill(updatedDescription);
    await page.getByPlaceholder("Enter system prompt for this agent").fill(updatedPrompt);
    await page.getByPlaceholder("Comma-separated tags").fill("qa, updated");
    await page.getByRole("button", { name: "Save", exact: true }).click();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText(updatedDescription, { exact: true })).toBeVisible();
    await expect(page.getByText(updatedPrompt, { exact: true })).toBeVisible();
    await expect(page.getByText("updated", { exact: true })).toBeVisible();
    expectNoJSErrors(pageErrors);
  });
});

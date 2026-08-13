import { expect } from "@playwright/test";
import { test, navigateAndWait, expectNoJSErrors } from "./fixtures";

test.describe("Distillation workflow", () => {
  test("creates, reopens, edits, reloads, and deletes a draft", async ({
    page,
    pageErrors,
  }, testInfo) => {
    const runId = `${Date.now()}-${testInfo.workerIndex}-${testInfo.repeatEachIndex}`;
    const title = `Distillation E2E ${runId}`;
    const updatedTitle = `Updated Distillation ${runId}`;
    const updatedSummary = `Updated reusable summary ${runId}`;

    await navigateAndWait(page, "/distillation-studio");
    await page.getByText("Title", { exact: true }).locator("..").getByRole("textbox").fill(title);
    await page
      .getByText("Source ID", { exact: true })
      .locator("..")
      .getByRole("textbox")
      .fill(`source-${runId}`);
    await page
      .getByText("Source Label", { exact: true })
      .locator("..")
      .getByRole("textbox")
      .fill("E2E source");
    await page
      .getByText("Summary", { exact: true })
      .locator("..")
      .getByRole("textbox")
      .fill(`Initial summary ${runId}`);
    await page.getByPlaceholder(/Describe what this distillation/).fill("Extract durable lessons");
    await page.getByRole("button", { name: "Save Draft" }).click();
    await expect(page.getByText("Successfully created distillation")).toBeVisible();

    await navigateAndWait(page, "/distillations");
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    const draftCard = page.locator(".group").filter({ hasText: title });
    await draftCard.getByRole("link", { name: "Open In Studio" }).click();
    await expect(page).toHaveURL(/distillationId=/);

    await page
      .getByText("Title", { exact: true })
      .locator("..")
      .getByRole("textbox")
      .fill(updatedTitle);
    await page
      .getByText("Summary", { exact: true })
      .locator("..")
      .getByRole("textbox")
      .fill(updatedSummary);
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByText("Successfully updated distillation")).toBeVisible();

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByText("Title", { exact: true }).locator("..").getByRole("textbox"),
    ).toHaveValue(updatedTitle);
    await expect(
      page.getByText("Summary", { exact: true }).locator("..").getByRole("textbox"),
    ).toHaveValue(updatedSummary);

    await navigateAndWait(page, "/distillations");
    const updatedCard = page.locator(".group").filter({ hasText: updatedTitle });
    await expect(updatedCard).toBeVisible();
    await updatedCard.getByRole("button", { name: `Delete ${updatedTitle}` }).click();
    await expect(page.getByText(updatedTitle, { exact: true })).toHaveCount(0);

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(updatedTitle, { exact: true })).toHaveCount(0);
    expectNoJSErrors(pageErrors);
  });
});

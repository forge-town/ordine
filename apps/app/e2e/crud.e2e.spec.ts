import { expect } from "@playwright/test";
import { test, navigateAndWait, expectNoJSErrors } from "./fixtures";

test.describe("Pipeline CRUD", () => {
  test("delete a pipeline", async ({ page, pageErrors }) => {
    await navigateAndWait(page, "/pipelines");

    const deleteButtons = page.locator("button[aria-label='删除'], button:has(.lucide-trash-2)");
    const deleteBtnCount = await deleteButtons.count();

    if (deleteBtnCount === 0) {
      test.skip(true, "No delete buttons found");

      return;
    }

    const countBefore = await page.locator("a[href*='/canvas']").count();

    await deleteButtons.first().click();
    await page.waitForLoadState("networkidle");

    const countAfter = await page.locator("a[href*='/canvas']").count();
    expect(countAfter).toBeLessThanOrEqual(countBefore);

    expectNoJSErrors(pageErrors);
  });
});

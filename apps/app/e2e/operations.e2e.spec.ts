import { expect } from "@playwright/test";
import { test, smokeCheck } from "./fixtures";

test.describe("Operations Page", () => {
  test("page renders correctly", async ({ page, pageErrors }) => {
    await smokeCheck(page, "/operations", pageErrors);
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();
  });
});

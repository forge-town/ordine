import { expect } from "@playwright/test";
import { test, smokeCheck } from "./fixtures";

test.describe("Recipes Page", () => {
  test("page renders correctly", async ({ page, pageErrors }) => {
    await smokeCheck(page, "/recipes", pageErrors);
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();
  });
});

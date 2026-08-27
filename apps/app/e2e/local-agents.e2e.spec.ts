import { expect } from "@playwright/test";
import { test, smokeCheck } from "./fixtures";

test.describe("Local Agents Page", () => {
  test("page renders correctly", async ({ page, pageErrors }) => {
    await smokeCheck(page, "/runtimes", pageErrors);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: /Re-scan|重新扫描/ })).toBeVisible();
  });
});

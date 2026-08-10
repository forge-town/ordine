import { expect } from "@playwright/test";
import { test, smokeCheck } from "./fixtures";

test.describe("Agents Page", () => {
  test("page renders correctly", async ({ page, pageErrors }) => {
    await smokeCheck(page, "/agents", pageErrors);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

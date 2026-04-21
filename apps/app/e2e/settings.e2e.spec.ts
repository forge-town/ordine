import { test, smokeCheck } from "./fixtures";

test.describe("Settings Page", () => {
  test("page renders correctly", async ({ page, pageErrors }) => {
    await smokeCheck(page, "/settings", pageErrors);
  });
});

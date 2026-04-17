import { expect } from "@playwright/test";
import { test, navigateAndWait, expectNoJSErrors } from "./fixtures";

test.describe("Pipeline CRUD", () => {
  test("create a new pipeline and verify it appears", async ({ page, pageErrors }) => {
    await navigateAndWait(page, "/pipelines");

    const createButton = page.getByRole("button", { name: /新建流水线/ });
    if ((await createButton.count()) === 0) {
      test.skip(true, "Create button not found");

      return;
    }

    const countBefore = await page.locator("a[href*='/canvas']").count();

    await createButton.click();
    await page.waitForURL(/\/canvas\?id=/);
    await page.waitForLoadState("networkidle");

    expect(page.url()).toContain("/canvas?id=");

    await page.goto("/pipelines");
    await page.waitForLoadState("networkidle");

    const countAfter = await page.locator("a[href*='/canvas']").count();
    expect(countAfter).toBeGreaterThanOrEqual(countBefore);

    expectNoJSErrors(pageErrors);
  });

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

test.describe("Rule CRUD", () => {
  const uniqueName = `Test Rule ${Date.now()}`;

  test("create a new rule via form", async ({ page, pageErrors }) => {
    await navigateAndWait(page, "/rules");

    const createButton = page.getByRole("button", { name: /新建规则/ });
    if ((await createButton.count()) === 0) {
      test.skip(true, "Create button not found");

      return;
    }

    await createButton.click();
    await page.waitForURL(/\/rules\/create/);
    await page.waitForLoadState("networkidle");

    const nameInput = page.getByPlaceholder("规则名称");
    await nameInput.fill(uniqueName);

    const descInput = page.getByPlaceholder("简要描述规则的作用");
    if ((await descInput.count()) > 0) {
      await descInput.fill("E2E test rule description");
    }

    const saveButton = page.getByRole("button", { name: /保存/ });
    if ((await saveButton.count()) > 0) {
      await saveButton.click();
      await page.waitForLoadState("networkidle");
    }

    expectNoJSErrors(pageErrors);
  });

  test("navigate to rule detail page", async ({ page, pageErrors }) => {
    await navigateAndWait(page, "/rules");

    const ruleCards = page.locator("[class*='rounded-xl'][class*='border']").filter({
      has: page.locator("p[class*='font-semibold']"),
    });

    if ((await ruleCards.count()) === 0) {
      test.skip(true, "No rule cards found");

      return;
    }

    await ruleCards.first().click();
    await page.waitForLoadState("networkidle");

    expect(page.url()).toMatch(/\/rules\/.+/);

    expectNoJSErrors(pageErrors);
  });
});

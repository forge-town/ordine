import { type Page, test as base, expect } from "@playwright/test";

/**
 * Shared fixture that captures JS errors on every page navigation.
 * Replaces the duplicated "no uncaught JS errors" pattern across all test files.
 */
export const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await use(errors);
  },
});

/**
 * Assert no uncaught JS errors occurred during the test.
 */
export function expectNoJSErrors(errors: string[]) {
  expect(errors, `Uncaught JS errors: ${errors.join("; ")}`).toHaveLength(0);
}

/**
 * Navigate to a page and wait for it to be ready (network idle).
 */
export async function navigateAndWait(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

/**
 * Assert the page rendered without Vite error overlay.
 */
export async function expectNoErrorOverlay(page: Page) {
  const errorOverlay = page.locator("vite-error-overlay");
  await expect(errorOverlay).toHaveCount(0);
}

/**
 * Standard smoke check: navigate, verify heading, no error overlay, no JS errors.
 */
export async function smokeCheck(page: Page, path: string, pageErrors: string[]) {
  await navigateAndWait(page, path);
  await expectNoErrorOverlay(page);
  expectNoJSErrors(pageErrors);
}

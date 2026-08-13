import { type Page, test as base, expect } from "@playwright/test";

/**
 * Shared fixture that captures JS errors on every page navigation.
 * Replaces the duplicated "no uncaught JS errors" pattern across all test files.
 */
export const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: async ({ page }, use) => {
    const errors: string[] = [];
    await page.addInitScript(() => {
      globalThis.localStorage.setItem("i18nextLng", "en");
      globalThis.localStorage.setItem(
        "ordine.theme",
        JSON.stringify({ state: { preference: "light" }, version: 0 }),
      );
    });
    page.on("pageerror", (err) => errors.push(err.message));
    await use(errors);
  },
});

/**
 * Assert no uncaught JS errors occurred during the test.
 */
export const expectNoJSErrors = (errors: string[]) => {
  expect(errors, `Uncaught JS errors: ${errors.join("; ")}`).toHaveLength(0);
};

/**
 * Navigate to a page and wait for the document to be ready.
 *
 * The application keeps background queries alive, so `networkidle` is not a
 * reliable readiness signal. Individual tests should wait for the UI state
 * they need after this helper returns.
 */
export const navigateAndWait = async (page: Page, path: string) => {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toBeVisible();
};

/**
 * Assert the page rendered without Vite error overlay.
 */
export const expectNoErrorOverlay = async (page: Page) => {
  const errorOverlay = page.locator("vite-error-overlay");
  await expect(errorOverlay).toHaveCount(0);
};

export const getCanvasTitleInput = (page: Page) =>
  page.getByRole("textbox", { name: "Pipeline title" });

export const expectCanvasTitle = async (page: Page, title: string) => {
  await expect(getCanvasTitleInput(page)).toHaveValue(title);
};

export const saveCanvas = async (page: Page) => {
  await page.getByRole("button", { name: "Workspace", exact: true }).click();
  const workspace = page.getByTestId("canvas-workspace-sidebar-overlay");
  await expect(workspace).toBeVisible();
  await workspace.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Pipeline saved", { exact: true })).toBeVisible();
};

export const renameCanvasPipeline = async (page: Page, title: string) => {
  await getCanvasTitleInput(page).fill(title);
  await saveCanvas(page);
  await expectCanvasTitle(page, title);
};

/**
 * Standard smoke check: navigate, verify heading, no error overlay, no JS errors.
 */
export const smokeCheck = async (page: Page, path: string, pageErrors: string[]) => {
  await navigateAndWait(page, path);
  await expectNoErrorOverlay(page);
  expectNoJSErrors(pageErrors);
};

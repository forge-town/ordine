import { createRequire } from "node:module";
import { expect } from "@playwright/test";
import { test, navigateAndWait, expectNoJSErrors } from "./fixtures";

const rootRequire = createRequire(import.meta.url);
const a11yAddonEntry = rootRequire.resolve("@storybook/addon-a11y");
const axeScriptPath = createRequire(a11yAddonEntry).resolve("axe-core/axe.min.js");

type AxeViolation = {
  help: string;
  id: string;
  impact: "minor" | "moderate" | "serious" | "critical" | null;
  nodes: Array<{ html: string; target: string[] }>;
};

test.describe("COD-355 frontend acceptance", () => {
  test("switches the develop theme and language controls", async ({ page, pageErrors }) => {
    await navigateAndWait(page, "/settings");

    const darkTheme = page.getByTestId("settings-appearance-dark");
    await darkTheme.click();
    await expect(darkTheme).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.style.colorScheme))
      .toBe("dark");

    const lightTheme = page.getByTestId("settings-appearance-light");
    await lightTheme.click();
    await expect(lightTheme).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("html")).not.toHaveClass(/dark/);

    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "English (US)" }).click();
    await page.getByRole("button", { name: /Save changes|保存更改/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => localStorage.getItem("i18nextLng"))).toMatch(/^en/);

    expectNoJSErrors(pageErrors);
  });

  test("supports keyboard search, visible focus, and reduced motion", async ({
    page,
    pageErrors,
  }) => {
    await navigateAndWait(page, "/pipelines");
    await page.keyboard.press("Control+K");
    const searchDialog = page.getByRole("dialog");
    await expect(searchDialog).toBeVisible();
    await expect(searchDialog.getByRole("textbox")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(searchDialog).toHaveCount(0);

    await page.locator("body").press("Tab");
    const focusEvidence = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      const style = element ? getComputedStyle(element) : null;

      return {
        accessibleName: element?.getAttribute("aria-label") ?? element?.textContent?.trim() ?? "",
        boxShadow: style?.boxShadow ?? "none",
        outlineStyle: style?.outlineStyle ?? "none",
        tagName: element?.tagName ?? "",
      };
    });
    expect(focusEvidence.accessibleName.length).toBeGreaterThan(0);
    expect(["A", "BUTTON", "INPUT"]).toContain(focusEvidence.tagName);
    expect(focusEvidence.boxShadow !== "none" || focusEvidence.outlineStyle !== "none").toBe(true);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await navigateAndWait(page, "/canvas");
    const reducedMotion = await page.evaluate(() => {
      const animatedSurface = document.querySelector<HTMLElement>(".fade-rise");
      const style = animatedSurface ? getComputedStyle(animatedSurface) : null;
      const animationDuration = style?.animationDuration ?? "0s";
      const transitionDuration = style?.transitionDuration ?? "0s";

      return {
        animationMs: animationDuration.endsWith("ms")
          ? Number.parseFloat(animationDuration)
          : Number.parseFloat(animationDuration) * 1000,
        scrollBehavior: style?.scrollBehavior ?? "auto",
        transitionMs: transitionDuration.endsWith("ms")
          ? Number.parseFloat(transitionDuration)
          : Number.parseFloat(transitionDuration) * 1000,
      };
    });
    expect(reducedMotion.animationMs).toBeLessThanOrEqual(0.02);
    expect(reducedMotion.transitionMs).toBeLessThanOrEqual(0.02);
    expect(reducedMotion.scrollBehavior).toBe("auto");

    expectNoJSErrors(pageErrors);
  });

  test("has no serious or critical Axe violations on shared Pipelines and Canvas", async ({
    page,
    pageErrors,
  }) => {
    const violationsByRoute: Record<string, AxeViolation[]> = {};

    for (const route of ["/pipelines", "/canvas"]) {
      await navigateAndWait(page, route);
      await page.addScriptTag({ path: axeScriptPath });
      const violations = await page.evaluate(async () => {
        const axe = (
          globalThis as unknown as {
            axe: {
              run: (
                root: Document,
                options: Record<string, unknown>,
              ) => Promise<{ violations: AxeViolation[] }>;
            };
          }
        ).axe;
        const result = await axe.run(document, {
          runOnly: {
            type: "tag",
            values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
          },
        });

        return result.violations.filter(
          (violation) => violation.impact === "critical" || violation.impact === "serious",
        );
      });
      violationsByRoute[route] = violations;
    }

    expect(violationsByRoute, JSON.stringify(violationsByRoute, null, 2)).toEqual({
      "/canvas": [],
      "/pipelines": [],
    });
    expectNoJSErrors(pageErrors);
  });
});

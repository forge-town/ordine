import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";

const visualEvidenceEnabled = process.env.COD355_VISUAL_EVIDENCE === "1";
const alanHarnessEnabled = process.env.COD355_ALAN_HARNESS === "1";
const evidenceRoot = path.resolve(process.cwd(), "../../pr-assets/cod-355");
const desktopViewport = { height: 900, width: 1440 };
const responsiveViewports = [
  { height: 900, width: 1440 },
  { height: 820, width: 1180 },
  { height: 820, width: 981 },
  { height: 820, width: 701 },
  { height: 844, width: 390 },
] as const;

type Version = "alan" | "before" | "after";

type Surface = {
  name: string;
  routes: Record<Version, string>;
  normalizeSearch?: boolean;
};

const surfaces: Surface[] = [
  {
    name: "pipelines",
    normalizeSearch: true,
    routes: {
      alan: "http://localhost:9440/pipelines",
      before: "http://localhost:9450/pipelines",
      after: "http://localhost:9430/pipelines",
    },
  },
  {
    name: "components",
    normalizeSearch: true,
    routes: {
      alan: "http://localhost:9440/components",
      before: "http://localhost:9450/components",
      after: "http://localhost:9430/components",
    },
  },
  {
    name: "operations",
    normalizeSearch: true,
    routes: {
      alan: "http://localhost:9440/pipelines/operations",
      before: "http://localhost:9450/pipelines/operations",
      after: "http://localhost:9430/pipelines/operations",
    },
  },
  {
    name: "jobs",
    normalizeSearch: true,
    routes: {
      alan: "http://localhost:9440/jobs",
      before: "http://localhost:9450/pipelines/jobs",
      after: "http://localhost:9430/pipelines/jobs",
    },
  },
  {
    name: "settings",
    routes: {
      alan: "http://localhost:9440/settings",
      before: "http://localhost:9450/settings",
      after: "http://localhost:9430/settings",
    },
  },
  {
    name: "canvas",
    routes: {
      alan: "http://localhost:9440/pipelines",
      before: "http://localhost:9450/canvas",
      after: "http://localhost:9430/canvas",
    },
  },
];

const initializeStablePresentation = async (page: Page) => {
  await page.addInitScript(() => {
    localStorage.setItem("i18nextLng", "en");
    localStorage.setItem(
      "ordine.theme",
      JSON.stringify({ state: { preference: "light" }, version: 0 }),
    );
  });
};

const hideDynamicOverlays = async (page: Page) => {
  await page.addStyleTag({
    content: `
      div.fixed.top-4.right-4.z-50.flex.flex-col.gap-2 { display: none !important; }
      * { caret-color: transparent !important; }
    `,
  });
};

const normalizeSurfaceState = async (page: Page, surface: Surface) => {
  if (!surface.normalizeSearch) {
    return;
  }

  const searchInputs = page.locator("main input");
  const count = await searchInputs.count();
  if (count > 0) {
    await searchInputs.last().fill("cod355-visual-no-match");
    await page.waitForTimeout(250);
  }
};

const captureSurface = async ({
  page,
  surface,
  version,
  viewport,
}: {
  page: Page;
  surface: Surface;
  version: Version;
  viewport: { height: number; width: number };
}) => {
  await page.setViewportSize(viewport);
  if (surface.name === "canvas" && version === "alan") {
    const pipelinesSurface = surfaces.find((candidate) => candidate.name === "pipelines");
    if (!pipelinesSurface) {
      throw new Error("Pipelines visual surface is missing");
    }

    await page.goto(pipelinesSurface.routes.alan, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "New Pipeline" })).toBeVisible();
    await page.getByRole("button", { name: "New Pipeline" }).click();
    await page.waitForURL(/\/workspace\/pipeline-[a-f0-9-]+\/?$/);
    await expect(page.getByTestId("canvas-v2-root")).toBeVisible();
  } else {
    await page.goto(surface.routes[version], { waitUntil: "domcontentloaded" });
  }
  await page.locator("body").waitFor({ state: "visible" });
  await page.waitForTimeout(1100);
  await expect
    .poll(
      async () => {
        const bodyText = await page.locator("body").textContent();

        return bodyText?.trim().length ?? 0;
      },
      { timeout: 20_000 },
    )
    .toBeGreaterThan(20);
  await hideDynamicOverlays(page);
  await normalizeSurfaceState(page, surface);

  const filename = `${surface.name}-${viewport.width}x${viewport.height}-${version}.png`;
  const filePath = path.join(evidenceRoot, filename);
  await page.screenshot({ animations: "disabled", path: filePath });

  return filePath;
};

const captureCanvasNodeCard = async ({ page, version }: { page: Page; version: Version }) => {
  const canvasSurface = surfaces.find((surface) => surface.name === "canvas");
  if (!canvasSurface) {
    throw new Error("Canvas visual surface is missing");
  }

  await page.setViewportSize(desktopViewport);
  const entryRoute =
    version === "alan"
      ? surfaces.find((surface) => surface.name === "pipelines")!.routes.alan
      : canvasSurface.routes[version];
  await page.goto(entryRoute, { waitUntil: "domcontentloaded" });
  await page.locator("body").waitFor({ state: "visible" });
  await page.waitForTimeout(1200);
  await hideDynamicOverlays(page);

  const node: Locator =
    version === "alan"
      ? await (async () => {
          await expect(page.getByRole("button", { name: "New Pipeline" })).toBeVisible();
          await page.getByRole("button", { name: "New Pipeline" }).click();
          await page.waitForURL(/\/workspace\/pipeline-[a-f0-9-]+\/?$/);

          const seedButton = page.getByTestId("canvas-v2-empty-seed");
          await expect(seedButton).toBeVisible();
          await seedButton.click();

          return page.getByTestId("canvas-v2-node-shell-root").first();
        })()
      : version === "before"
        ? await (async () => {
            await page
              .getByRole("button", { name: /^File File/ })
              .first()
              .click();

            return page.locator(".react-flow__node-file").first();
          })()
        : await (async () => {
            await page.getByTestId("canvas-component-object-file").click();
            await page.getByTestId("canvas-v2-settings").click();
            await page.getByRole("button", { name: "Expanded" }).click();
            await page.getByRole("button", { name: "Close Canvas settings" }).click();

            return page.locator(".react-flow__node-file").first();
          })();

  await expect(node).toBeVisible();
  await node.hover();
  await page.waitForTimeout(200);
  await hideDynamicOverlays(page);

  const filePath = path.join(evidenceRoot, `canvas-nodecard-1440x900-${version}.png`);
  await page.screenshot({ animations: "disabled", path: filePath });

  return filePath;
};

const captureDifference = async ({
  afterPath,
  beforePath,
  page,
  surface,
  viewport,
}: {
  afterPath: string;
  beforePath: string;
  page: Page;
  surface: Surface;
  viewport: { height: number; width: number };
}) => {
  const [after, before] = await Promise.all([readFile(afterPath), readFile(beforePath)]);
  const afterUrl = `data:image/png;base64,${after.toString("base64")}`;
  const beforeUrl = `data:image/png;base64,${before.toString("base64")}`;
  await page.setViewportSize(viewport);
  await page.setContent(`
    <!doctype html>
    <html>
      <head>
        <style>
          html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; background: #000; }
          .stack { position: relative; width: 100%; height: 100%; }
          img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: fill; }
          img.after { mix-blend-mode: difference; }
        </style>
      </head>
      <body>
        <div class="stack">
          <img alt="Before" src="${beforeUrl}" />
          <img alt="After difference" class="after" src="${afterUrl}" />
        </div>
      </body>
    </html>
  `);
  await page.waitForFunction(() =>
    [...document.images].every((image) => image.complete && image.naturalWidth > 0),
  );
  await page.screenshot({
    animations: "disabled",
    path: path.join(evidenceRoot, `${surface.name}-${viewport.width}x${viewport.height}-diff.png`),
  });
};

test.describe("COD-355 visual evidence", () => {
  test.skip(
    !visualEvidenceEnabled || !alanHarnessEnabled,
    "Set COD355_VISUAL_EVIDENCE=1 and COD355_ALAN_HARNESS=1; exact Alan harness is currently blocked by the fixed reference infrastructure.",
  );

  test("captures Alan, Before, After, Diff, and five Canvas viewports", async ({ page }) => {
    test.setTimeout(180_000);
    await mkdir(evidenceRoot, { recursive: true });
    await initializeStablePresentation(page);

    for (const surface of surfaces) {
      const alanPath = await captureSurface({
        page,
        surface,
        version: "alan",
        viewport: desktopViewport,
      });
      const beforePath = await captureSurface({
        page,
        surface,
        version: "before",
        viewport: desktopViewport,
      });
      const afterPath = await captureSurface({
        page,
        surface,
        version: "after",
        viewport: desktopViewport,
      });

      await expect(readFile(alanPath)).resolves.toBeTruthy();
      await captureDifference({ afterPath, beforePath, page, surface, viewport: desktopViewport });
    }

    const canvasSurface = surfaces.find((surface) => surface.name === "canvas");
    expect(canvasSurface).toBeDefined();
    if (!canvasSurface) {
      return;
    }

    for (const viewport of responsiveViewports.slice(1)) {
      await captureSurface({ page, surface: canvasSurface, version: "after", viewport });
    }

    await page.setViewportSize(desktopViewport);
    await page.goto("http://localhost:9430/settings", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
    await hideDynamicOverlays(page);
    await page.getByTestId("settings-appearance-dark").click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.screenshot({
      animations: "disabled",
      path: path.join(evidenceRoot, "settings-1440x900-after-dark-en.png"),
    });

    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "简体中文" }).click();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "设置" })).toBeVisible();
    await page.screenshot({
      animations: "disabled",
      path: path.join(evidenceRoot, "settings-1440x900-after-dark-zh.png"),
    });
  });

  test("captures direct Alan, Before, and After NodeCard states", async ({ page }) => {
    test.setTimeout(90_000);
    await mkdir(evidenceRoot, { recursive: true });
    await initializeStablePresentation(page);

    const alanPath = await captureCanvasNodeCard({ page, version: "alan" });
    const beforePath = await captureCanvasNodeCard({ page, version: "before" });
    const afterPath = await captureCanvasNodeCard({ page, version: "after" });
    const nodeCardSurface: Surface = {
      name: "canvas-nodecard",
      routes: surfaces.find((surface) => surface.name === "canvas")!.routes,
    };

    await expect(readFile(alanPath)).resolves.toBeTruthy();
    await captureDifference({
      afterPath,
      beforePath,
      page,
      surface: nodeCardSurface,
      viewport: desktopViewport,
    });
  });
});

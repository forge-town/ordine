import { expect, type Locator, type Page, type Route, type TestInfo } from "@playwright/test";
import { test, navigateAndWait, expectNoJSErrors } from "./fixtures";

type InteractionMetric = {
  durationMs: number;
  name: string;
};

type RenderingMetric = {
  frameCount: number;
  maxFrameGapMs: number;
  maxLongTaskMs: number;
  p95FrameGapMs: number;
};

const startRenderingSample = (page: Page) =>
  page.evaluate(() => {
    const state = {
      active: true,
      frameGaps: [] as number[],
      lastFrameAt: 0,
      longTasks: [] as number[],
    };
    const browserWindow = globalThis as typeof globalThis & {
      __canvasRenderingSample?: typeof state;
    };
    browserWindow.__canvasRenderingSample = state;

    const observer = new PerformanceObserver((list) => {
      state.longTasks.push(...list.getEntries().map((entry) => entry.duration));
    });
    if (PerformanceObserver.supportedEntryTypes.includes("longtask")) {
      observer.observe({ entryTypes: ["longtask"] });
    }

    const sampleFrame = (now: number) => {
      if (!state.active) {
        observer.disconnect();

        return;
      }
      if (state.lastFrameAt > 0) {
        state.frameGaps.push(now - state.lastFrameAt);
      }
      state.lastFrameAt = now;
      requestAnimationFrame(sampleFrame);
    };
    requestAnimationFrame(sampleFrame);
  });

const finishRenderingSample = async (page: Page): Promise<RenderingMetric> =>
  page.evaluate(() => {
    const browserWindow = globalThis as typeof globalThis & {
      __canvasRenderingSample?: {
        active: boolean;
        frameGaps: number[];
        longTasks: number[];
      };
    };
    const state = browserWindow.__canvasRenderingSample;
    if (!state) {
      return { frameCount: 0, maxFrameGapMs: 0, maxLongTaskMs: 0, p95FrameGapMs: 0 };
    }
    state.active = false;
    const frameGaps = [...state.frameGaps].sort((left, right) => left - right);
    const p95Index = Math.min(frameGaps.length - 1, Math.floor(frameGaps.length * 0.95));

    return {
      frameCount: frameGaps.length,
      maxFrameGapMs: Math.round(frameGaps.at(-1) ?? 0),
      maxLongTaskMs: Math.round(Math.max(0, ...state.longTasks)),
      p95FrameGapMs: Math.round(frameGaps[Math.max(0, p95Index)] ?? 0),
    };
  });

const measureInteraction = async (
  page: Page,
  metrics: InteractionMetric[],
  name: string,
  action: () => Promise<void>,
) => {
  const startedAt = await page.evaluate(() => performance.now());
  await action();
  const finishedAt = await page.evaluate(() => performance.now());
  metrics.push({ durationMs: Math.round(finishedAt - startedAt), name });
};

const dragNodeBy = async (page: Page, node: Locator, delta: { x: number; y: number }) => {
  const before = await node.boundingBox();
  expect(before).not.toBeNull();
  if (!before) return;

  const start = { x: before.x + 20, y: before.y + 20 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + delta.x, start.y + delta.y, { steps: 16 });
  await page.mouse.up();

  await expect
    .poll(async () => {
      const after = await node.boundingBox();

      return after ? Math.hypot(after.x - before.x, after.y - before.y) : 0;
    })
    .toBeGreaterThan(60);
};

const connectNodes = async (page: Page, sourceNode: Locator, targetNode: Locator) => {
  const sourcePort = sourceNode.locator(".react-flow__handle-right").first();
  const targetPort = targetNode.locator(".react-flow__handle-left").first();
  const source = await sourcePort.boundingBox();
  const target = await targetPort.boundingBox();
  expect(source).not.toBeNull();
  expect(target).not.toBeNull();
  if (!source || !target) return;

  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 16 });
  await page.mouse.up();
};

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    body: JSON.stringify(body),
    contentType: "application/json",
    status,
  });

const mockCanvasAgent = async (page: Page) => {
  const state = { messageIndex: 0 };
  await page.route("http://localhost:9433/api/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname === "/api/pipeline-agent-sessions" && request.method() === "POST") {
      await json(route, {
        id: "canvas-e2e-session",
        entrypoint: "canvas-agent-panel",
        mode: "edit",
        status: "draft",
      });

      return;
    }
    if (pathname.endsWith("/messages") && request.method() === "POST") {
      const input = request.postDataJSON() as { content: string; kind: string; role: string };
      state.messageIndex += 1;
      await json(route, { id: `canvas-e2e-message-${state.messageIndex}`, ...input });

      return;
    }
    if (pathname.endsWith("/plan") && request.method() === "POST") {
      await route.fulfill({
        body: `event: question\ndata: ${JSON.stringify({ question: "Which output should receive the review?" })}\n\n`,
        contentType: "text/event-stream",
        status: 200,
      });

      return;
    }

    await route.abort("failed");
  });
};

const createOperation = async (page: Page, operationId: string) => {
  const response = await page.request.post("/api/trpc/operations.create?batch=1", {
    data: {
      0: {
        json: {
          acceptedObjectTypes: ["file"],
          config: { inputs: [], outputs: [] },
          description: "Canvas E2E operation",
          id: operationId,
          name: "Canvas E2E Transform",
        },
      },
    },
  });
  expect(response.ok()).toBe(true);
};

const openCanvasPage = async (page: Page, runId: string) => {
  await navigateAndWait(page, "/pipelines");
  const pipelineId = `pipeline-e2e-${runId}`;
  const createResponse = await page.request.post("/api/trpc/pipelines.create?batch=1", {
    data: {
      0: {
        json: {
          pipeline: {
            id: pipelineId,
            name: "Canvas E2E Pipeline",
            description: "",
            sharedContext: "",
            tags: ["e2e"],
            timeoutMs: null,
            nodes: [],
            edges: [],
          },
        },
      },
    },
  });
  expect(createResponse.ok()).toBe(true);

  await navigateAndWait(page, `/canvas?id=${pipelineId}`);
};

test.describe("Canvas editor", () => {
  test("keeps the desktop Canvas inside 701-1440px viewports", async ({
    page,
    pageErrors,
  }, testInfo) => {
    await openCanvasPage(page, `responsive-${Date.now()}-${testInfo.workerIndex}`);

    for (const width of [1440, 1180, 981, 701]) {
      await page.setViewportSize({ width, height: 820 });
      await expect(page.getByTestId("canvas-langflow-shell")).toBeVisible();
      await expect(page.getByTestId("canvas-top-chrome")).toBeVisible();
      await expect(page.getByTestId("canvas-toolbar")).toBeVisible();
      await expect(page.getByTestId("canvas-agent-panel-region")).toBeVisible();
      await expect(page.getByRole("button", { name: "Notifications" })).toBeVisible();

      const metrics = await page.evaluate(() => {
        const agentBounds = document
          .querySelector<HTMLElement>('[data-testid="canvas-agent-panel-region"]')
          ?.getBoundingClientRect();
        const shellBounds = document
          .querySelector<HTMLElement>('[data-testid="canvas-langflow-shell"]')
          ?.getBoundingClientRect();
        const topChromeBounds = document
          .querySelector<HTMLElement>('[data-testid="canvas-top-chrome"]')
          ?.getBoundingClientRect();

        return {
          agent: agentBounds
            ? {
                bottom: agentBounds.bottom,
                left: agentBounds.left,
                right: agentBounds.right,
                top: agentBounds.top,
              }
            : null,
          documentWidth: document.documentElement.scrollWidth,
          shell: shellBounds
            ? {
                bottom: shellBounds.bottom,
                left: shellBounds.left,
                right: shellBounds.right,
                top: shellBounds.top,
              }
            : null,
          topChrome: topChromeBounds
            ? {
                bottom: topChromeBounds.bottom,
                left: topChromeBounds.left,
                right: topChromeBounds.right,
                top: topChromeBounds.top,
              }
            : null,
          viewportWidth: globalThis.innerWidth,
        };
      });

      expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth);
      expect(metrics.shell?.left).toBeGreaterThanOrEqual(0);
      expect(metrics.shell?.right).toBeLessThanOrEqual(width + 1);
      if (width <= 1180) {
        expect(metrics.agent?.top).toBeGreaterThanOrEqual((metrics.topChrome?.bottom ?? 0) - 1);
      }

      await testInfo.attach(`canvas-${width}x820`, {
        body: await page.screenshot(),
        contentType: "image/png",
      });
    }

    expectNoJSErrors(pageErrors);
  });

  test("supports the current canvas component workflow", async ({ page, pageErrors }, testInfo) => {
    await openCanvasPage(page, `${Date.now()}-${testInfo.workerIndex}-${testInfo.repeatEachIndex}`);

    await expect(page.getByTestId("canvas-langflow-shell")).toBeVisible();
    await expect(page.getByTestId("canvas-flow-viewport")).toBeVisible();
    await expect(page.getByTestId("canvas-toolbar")).toBeVisible();
    await expect(page.getByTestId("canvas-top-chrome")).toBeVisible();
    await expect(page.getByTestId("canvas-component-panel")).toBeVisible();
    await expect(page.getByTestId("canvas-agent-panel")).toBeVisible();

    const folderButton = page.getByRole("button", {
      name: /(?:Folder Folder|文件夹 文件夹)/,
    });
    await expect(folderButton).toBeVisible();

    await folderButton.click();
    await expect(
      page.getByTestId("canvas-flow-viewport").locator(".react-flow__node").first(),
    ).toBeVisible();

    expectNoJSErrors(pageErrors);
  });

  test("keeps create, drag, connect, move, and Agent composer interactions responsive", async ({
    page,
    pageErrors,
  }, testInfo: TestInfo) => {
    test.setTimeout(60_000);
    const runId = `${Date.now()}-${testInfo.workerIndex}-${testInfo.repeatEachIndex}`;
    const operationId = `operation-e2e-${runId}`;
    const interactions: InteractionMetric[] = [];

    await mockCanvasAgent(page);
    await navigateAndWait(page, "/local-agents");
    await page.getByRole("button", { name: "Re-scan" }).click();
    const runtimeDialog = page.getByRole("dialog", { name: "Runtime scan results" });
    await expect(runtimeDialog).toBeVisible();
    const syncButton = runtimeDialog.getByRole("button", { name: "Sync changes" });
    if (await syncButton.isVisible()) {
      await syncButton.click();
    } else {
      await expect(runtimeDialog.getByText("No runtime changes detected.")).toBeVisible();
      await runtimeDialog.getByRole("button", { name: "Cancel", exact: true }).click();
    }
    await expect(runtimeDialog).toHaveCount(0);
    await expect(page.getByText(/\d+ of 5 supported Local Agents are synced\./)).toBeVisible();
    await openCanvasPage(page, runId);
    await createOperation(page, operationId);
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("canvas-flow-viewport")).toBeVisible();
    await startRenderingSample(page);

    const componentPanel = page.getByTestId("canvas-component-panel");
    const flow = page.getByTestId("canvas-flow-viewport");
    const fileEntry = componentPanel.getByRole("button", { name: /^File File/ });
    const operationEntry = componentPanel.getByTestId(`canvas-operation-${operationId}`);
    await expect(operationEntry).toBeVisible();

    await measureInteraction(page, interactions, "drag file from palette", async () => {
      await fileEntry.dragTo(flow, { targetPosition: { x: 120, y: 120 } });
      await expect(page.locator(".react-flow__node-file")).toHaveCount(1);
    });
    await measureInteraction(page, interactions, "add operation from palette", async () => {
      await operationEntry.click();
      await expect(page.locator(".react-flow__node-operation")).toHaveCount(1);
    });

    const fileNode = page.locator(".react-flow__node-file");
    const operationNode = page.locator(".react-flow__node-operation");
    await page.getByRole("button", { name: "Select" }).click();
    const operationPositionBeforeMove = await operationNode.boundingBox();
    await measureInteraction(page, interactions, "move operation node", async () => {
      await dragNodeBy(page, operationNode, { x: 120, y: 80 });
    });
    await page.getByTitle("Undo").click();
    await expect
      .poll(async () => {
        const afterUndo = await operationNode.boundingBox();
        if (!operationPositionBeforeMove || !afterUndo) return Number.POSITIVE_INFINITY;

        return Math.hypot(
          afterUndo.x - operationPositionBeforeMove.x,
          afterUndo.y - operationPositionBeforeMove.y,
        );
      })
      .toBeLessThan(12);
    await page.getByTitle("Redo").click();

    await measureInteraction(page, interactions, "connect file to operation", async () => {
      await connectNodes(page, fileNode, operationNode);
      await expect(page.locator(".react-flow__edge")).toHaveCount(1);
    });

    await measureInteraction(page, interactions, "send canvas Agent message", async () => {
      await page.getByRole("textbox", { name: "Message" }).fill("Review the connected nodes");
      await expect(page.getByTestId("agent-composer-send")).toBeEnabled();
      await page.getByTestId("agent-composer-send").click();
      await expect(page.getByText("Which output should receive the review?")).toBeVisible();
    });

    const rendering = await finishRenderingSample(page);
    await testInfo.attach("canvas-interaction-metrics", {
      body: JSON.stringify({ interactions, rendering }, null, 2),
      contentType: "application/json",
    });
    process.stdout.write(
      `CANVAS_INTERACTION_METRICS ${JSON.stringify({ interactions, rendering })}\n`,
    );

    expect(Math.max(...interactions.map((metric) => metric.durationMs))).toBeLessThan(2000);
    expect(rendering.frameCount).toBeGreaterThan(20);
    // Windows headless Chromium can fall onto a 15 Hz cadence while the full
    // serial E2E suite is under load. Keep the interaction and long-task gates
    // strict, while allowing that scheduler cadence without masking stalls.
    expect(rendering.p95FrameGapMs).toBeLessThanOrEqual(75);
    expect(rendering.maxLongTaskMs).toBeLessThan(250);
    expectNoJSErrors(pageErrors);
  });
});

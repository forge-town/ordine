import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";
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

  const start = { x: before.x + before.width / 2, y: before.y + before.height / 2 };
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
  const sourcePort = sourceNode.getByTestId("canvas-v2-node-right-port").first();
  const targetPort = targetNode.getByTestId("canvas-v2-node-left-port").first();
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
  test("supports the current canvas component workflow", async ({ page, pageErrors }, testInfo) => {
    await openCanvasPage(page, `${Date.now()}-${testInfo.workerIndex}-${testInfo.repeatEachIndex}`);

    await expect(page.getByTestId("canvas-v2-root")).toBeVisible();
    await expect(page.getByTestId("canvas-v2-flow")).toBeVisible();
    await expect(page.getByTestId("canvas-v2-toolbar")).toBeVisible();
    await expect(page.getByTestId("canvas-v2-top-pill")).toBeVisible();

    await page.getByTestId("canvas-v2-components-toggle").click();
    await expect(page.getByTestId("canvas-v2-components-panel")).toBeVisible();

    const fileButton = page.getByTestId("canvas-v2-component-object-file");
    await expect(fileButton).toBeVisible();

    await fileButton.click();
    await expect(page.getByTestId("canvas-v2-node-card").first()).toBeVisible();

    expectNoJSErrors(pageErrors);
  });

  test("keeps create, drag, connect, move, and compose interactions responsive", async ({
    page,
    pageErrors,
  }, testInfo: TestInfo) => {
    test.setTimeout(45_000);
    const runId = `${Date.now()}-${testInfo.workerIndex}-${testInfo.repeatEachIndex}`;
    const operationId = `operation-e2e-${runId}`;
    const interactions: InteractionMetric[] = [];

    await openCanvasPage(page, runId);
    await createOperation(page, operationId);
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("canvas-v2-flow")).toBeVisible();
    await startRenderingSample(page);

    await page.getByTestId("canvas-v2-components-toggle").click();
    const flow = page.getByTestId("canvas-v2-flow");
    const fileEntry = page.getByTestId("canvas-v2-component-object-file");
    const operationEntry = page.getByTestId(`canvas-v2-component-operation-${operationId}`);
    await expect(operationEntry).toBeVisible();

    await measureInteraction(page, interactions, "drag file from palette", async () => {
      await fileEntry.dragTo(flow, { targetPosition: { x: 420, y: 320 } });
      await expect(page.locator(".react-flow__node-file")).toHaveCount(1);
    });
    await measureInteraction(page, interactions, "drag operation from palette", async () => {
      await operationEntry.dragTo(flow, { targetPosition: { x: 780, y: 320 } });
      await expect(page.locator(".react-flow__node-operation")).toHaveCount(1);
    });

    const fileNode = page.locator(".react-flow__node-file");
    const operationNode = page.locator(".react-flow__node-operation");
    await measureInteraction(page, interactions, "move operation node", async () => {
      await dragNodeBy(page, operationNode, { x: 120, y: 80 });
    });

    await measureInteraction(page, interactions, "connect file to operation", async () => {
      await connectNodes(page, fileNode, operationNode);
      await expect(page.locator(".react-flow__edge")).toHaveCount(1);
    });

    await fileNode.click();
    await operationNode.click({ modifiers: ["Shift"] });
    await expect(page.getByTestId("canvas-v2-compose-bar")).toBeVisible();
    await measureInteraction(page, interactions, "compose selected nodes", async () => {
      await page.getByTestId("canvas-v2-compose-action").click();
      await expect(page.locator(".react-flow__node-compound")).toHaveCount(1);
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
    expect(rendering.p95FrameGapMs).toBeLessThan(50);
    expect(rendering.maxLongTaskMs).toBeLessThan(250);
    expectNoJSErrors(pageErrors);
  });
});

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

const clickCanvasAction = async (page: Page, name: string) => {
  await page.getByTestId("canvas-actions-menu").click();
  await page.getByRole("menuitem", { name, exact: true }).click();
};

const dragNodeBy = async (page: Page, node: Locator, delta: { x: number; y: number }) => {
  const before = await node.boundingBox();
  expect(before).not.toBeNull();
  if (!before) return;

  const headerIcon = node
    .getByTestId("canvas-v2-node-card")
    .locator('[data-slot="card-header"] > div')
    .first();
  const headerIconBounds = await headerIcon.boundingBox();
  const start = headerIconBounds
    ? {
        x: headerIconBounds.x + headerIconBounds.width / 2,
        y: headerIconBounds.y + headerIconBounds.height / 2,
      }
    : { x: before.x + 20, y: before.y + 20 };
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
  const sessionId = "canvas-e2e-session";
  const runId = "canvas-e2e-run";
  const question = "Which output should receive the review?";
  const state = { messageIndex: 0, runCompleted: false };
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname === "/api/pipeline-agent-sessions" && request.method() === "POST") {
      await json(route, {
        id: sessionId,
        entrypoint: "canvas-agent-panel",
        mode: "edit",
        status: "draft",
      });

      return;
    }
    if (/^\/api\/pipeline-agent-sessions\/[^/]+$/.test(pathname) && request.method() === "GET") {
      await json(route, {
        id: pathname.split("/").at(-1),
        entrypoint: "canvas-agent-panel",
        mode: "edit",
        status: state.runCompleted ? "awaiting_user" : "draft",
        latestProposalId: null,
        createdPipelineId: null,
        attachments: [],
        messages: state.runCompleted
          ? [
              {
                id: "canvas-e2e-question",
                role: "assistant",
                kind: "question",
                content: question,
              },
            ]
          : [],
        proposals: [],
      });

      return;
    }
    if (pathname.endsWith("/messages") && request.method() === "POST") {
      const input = request.postDataJSON() as { content: string; kind: string; role: string };
      state.messageIndex += 1;
      await json(route, { id: `canvas-e2e-message-${state.messageIndex}`, ...input });

      return;
    }
    if (pathname.endsWith("/runs") && request.method() === "POST") {
      await json(route, { runId }, 202);

      return;
    }
    if (pathname.endsWith("/projection-run") && request.method() === "GET") {
      await route.fulfill({ status: 204 });

      return;
    }
    if (
      pathname.endsWith("/events") &&
      pathname.includes("/agent-runs/") &&
      request.method() === "GET"
    ) {
      state.runCompleted = true;
      await route.fulfill({
        body: `id: 1\ndata: ${JSON.stringify({
          runId,
          sequence: 1,
          createdAt: "2026-08-24T00:00:00.000Z",
          event: {
            type: "terminal",
            runtime: "codex",
            timestamp: "2026-08-24T00:00:00.000Z",
            status: "completed",
          },
        })}\n\n`,
        contentType: "text/event-stream",
        status: 200,
      });

      return;
    }

    await route.fallback();
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

const createAgentRuntime = async (page: Page, runtimeId: string) => {
  const response = await page.request.post("/api/trpc/agentRuntimes.create?batch=1", {
    data: {
      0: {
        json: {
          connection: { binaryName: "node", mode: "local" },
          id: runtimeId,
          name: "Canvas E2E Runtime",
          type: "hermes",
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
  test("keeps the Canvas inside 390-1440px viewports", async ({ page, pageErrors }, testInfo) => {
    await openCanvasPage(page, `responsive-${Date.now()}-${testInfo.workerIndex}`);

    for (const width of [1440, 1180, 981, 701, 390]) {
      await page.setViewportSize({ width, height: 820 });
      await expect(page.getByTestId("canvas-langflow-shell")).toBeVisible();
      await expect(page.getByTestId("canvas-top-chrome")).toBeVisible();
      await expect(page.getByTestId("canvas-v2-toolbar")).toBeVisible();
      await expect(page.getByTestId("canvas-agent-panel-region")).toBeVisible();
      if (width <= 768) {
        await expect(page.getByRole("button", { name: "Toggle Sidebar" })).toBeVisible();
      } else {
        await expect(page.getByTestId("notification-bell")).toBeVisible();
      }

      const metrics = await page.evaluate(() => {
        const agentBounds = document
          .querySelector<HTMLElement>('[data-testid="canvas-agent-panel-region"]')
          ?.getBoundingClientRect();
        const shellBounds = document
          .querySelector<HTMLElement>('[data-testid="canvas-langflow-shell"]')
          ?.getBoundingClientRect();
        const sidebarToggleBounds = document
          .querySelector<HTMLElement>('[data-sidebar="trigger"]')
          ?.getBoundingClientRect();
        const sidebarToggleBar = document.querySelector<HTMLElement>(
          '[data-sidebar="trigger"]',
        )?.parentElement;
        const topChromeBounds = document
          .querySelector<HTMLElement>('[data-testid="canvas-top-chrome"]')
          ?.getBoundingClientRect();
        const topRightControlSelectors = [
          '[data-testid="canvas-v2-state-legend-trigger"]',
          '[data-testid="canvas-v2-run"]',
          '[data-testid="canvas-v2-agent-reopen"]',
        ];
        const topRightControls = topRightControlSelectors.flatMap((selector) => {
          const bounds = document.querySelector<HTMLElement>(selector)?.getBoundingClientRect();

          return bounds
            ? [
                {
                  bottom: bounds.bottom,
                  left: bounds.left,
                  right: bounds.right,
                  selector,
                  top: bounds.top,
                },
              ]
            : [];
        });
        const agentShellBounds = document
          .querySelector<HTMLElement>('[data-testid="canvas-agent-panel-shell"]')
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
          agentShellWidth: agentShellBounds?.width ?? null,
          shell: shellBounds
            ? {
                bottom: shellBounds.bottom,
                left: shellBounds.left,
                right: shellBounds.right,
                top: shellBounds.top,
              }
            : null,
          sidebarToggle: sidebarToggleBounds
            ? {
                bottom: sidebarToggleBounds.bottom,
                left: sidebarToggleBounds.left,
                right: sidebarToggleBounds.right,
                top: sidebarToggleBounds.top,
              }
            : null,
          sidebarToggleBarZIndex: sidebarToggleBar
            ? Number.parseInt(getComputedStyle(sidebarToggleBar).zIndex, 10)
            : null,
          topChromeZIndex: document.querySelector<HTMLElement>('[data-testid="canvas-top-chrome"]')
            ? Number.parseInt(
                getComputedStyle(
                  document.querySelector<HTMLElement>('[data-testid="canvas-top-chrome"]')!,
                ).zIndex,
                10,
              )
            : null,
          topRightControls,
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
      if (width <= 768) {
        expect(metrics.sidebarToggle).not.toBeNull();
      }
      if (width === 390) {
        expect(metrics.sidebarToggleBarZIndex).toBeGreaterThan(metrics.topChromeZIndex ?? 0);
        expect(metrics.agentShellWidth).toBeGreaterThan(width - 2);
        for (const control of metrics.topRightControls) {
          expect(control.left).toBeGreaterThanOrEqual(-1);
          expect(control.right).toBeLessThanOrEqual(width + 1);
        }
      }

      process.stdout.write(`CANVAS_VIEWPORT_METRICS ${JSON.stringify({ width, ...metrics })}\n`);
    }

    expectNoJSErrors(pageErrors);
  });

  test("supports the current canvas component workflow", async ({ page, pageErrors }, testInfo) => {
    await openCanvasPage(page, `${Date.now()}-${testInfo.workerIndex}-${testInfo.repeatEachIndex}`);

    await expect(page.getByTestId("canvas-langflow-shell")).toBeVisible();
    await expect(page.getByTestId("canvas-flow-viewport")).toBeVisible();
    await expect(page.getByTestId("canvas-v2-toolbar")).toBeVisible();
    await expect(page.getByTestId("canvas-top-chrome")).toBeVisible();
    await expect(page.getByTestId("canvas-component-panel")).toBeVisible();
    await expect(page.getByTestId("canvas-agent-panel")).toBeVisible();

    await page.getByTestId("canvas-v2-state-legend-trigger").click();
    await expect(page.getByTestId("canvas-v2-state-legend")).toBeVisible();
    await expect(page.getByTestId("canvas-status-bar")).toBeVisible();
    await page.getByTestId("canvas-v2-state-legend-trigger").click();

    const folderButton = page.getByTestId("canvas-component-object-folder");
    await expect(folderButton).toBeVisible();

    await folderButton.click();
    const folderNode = page
      .getByTestId("canvas-flow-viewport")
      .locator(".react-flow__node")
      .first();
    await expect(folderNode).toBeVisible();
    await folderNode.hover();
    await folderNode.getByTestId("canvas-node-configure").click();

    const nodeConfig = page.getByTestId("canvas-v2-node-config");
    await expect(nodeConfig).toBeVisible();
    await expect(nodeConfig.getByTestId("node-config-label")).toBeVisible();
    await expect(page.getByTestId("canvas-properties-panel")).toHaveCSS("width", "440px");
    await testInfo.attach("canvas-node-config", {
      body: await page.screenshot(),
      contentType: "image/png",
    });
    await nodeConfig.getByTestId("node-config-done").click();
    await expect(nodeConfig).toHaveCount(0);

    await page.getByTestId("canvas-component-panel-toggle").click();
    await page.getByTestId("canvas-flow-viewport").click({
      button: "right",
      position: { x: 600, y: 520 },
    });
    const canvasMenu = page.getByRole("menu");
    await expect(canvasMenu).toBeVisible();
    await expect(canvasMenu).toHaveClass(/rounded-2xl/);
    await expect(canvasMenu.getByRole("menuitem", { name: /Folder/i }).first()).toBeVisible();
    await page.keyboard.press("Escape");

    await clickCanvasAction(page, "Quick add node");
    const quickAdd = page.getByRole("dialog", { name: "Quick add node" });
    await expect(quickAdd).toBeVisible();
    await expect(quickAdd).toHaveClass(/rounded-2xl/);
    await quickAdd.getByRole("button", { name: "Close quick add" }).click();
    await expect(quickAdd).toHaveCount(0);

    expectNoJSErrors(pageErrors);
  });

  test("keeps create, drag, connect, move, and Agent composer interactions responsive", async ({
    page,
    pageErrors,
  }, testInfo: TestInfo) => {
    test.setTimeout(60_000);
    const runId = `${Date.now()}-${testInfo.workerIndex}-${testInfo.repeatEachIndex}`;
    const operationId = `operation-e2e-${runId}`;
    const runtimeId = `runtime-e2e-${runId}`;
    const interactions: InteractionMetric[] = [];

    await mockCanvasAgent(page);
    await createAgentRuntime(page, runtimeId);
    await openCanvasPage(page, runId);
    await createOperation(page, operationId);
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("canvas-flow-viewport")).toBeVisible();
    await startRenderingSample(page);

    const componentPanel = page.getByTestId("canvas-component-panel");
    const flow = page.getByTestId("canvas-flow-viewport");
    const fileEntry = componentPanel.getByTestId("canvas-component-object-file");
    const operationEntry = componentPanel.getByTestId(`canvas-operation-${operationId}`);
    await expect(operationEntry).toBeVisible();

    await measureInteraction(page, interactions, "drag file from palette", async () => {
      await fileEntry.dragTo(flow, { targetPosition: { x: 450, y: 220 } });
      await expect(page.locator(".react-flow__node-file")).toHaveCount(1);
    });
    await measureInteraction(page, interactions, "add operation from palette", async () => {
      await operationEntry.click();
      await expect(page.locator(".react-flow__node-operation")).toHaveCount(1);
    });
    await page.getByTestId("canvas-component-panel-toggle").click();

    const fileNode = page.locator(".react-flow__node-file");
    const operationNode = page.locator(".react-flow__node-operation");
    await page.getByRole("button", { name: "Select" }).click();
    await expect(operationNode.getByTestId("canvas-v2-node-shell-root")).toHaveAttribute(
      "data-card-mode",
      "compact",
    );
    const operationTransformBeforeMove = await operationNode.evaluate(
      (element) => (element as HTMLElement).style.transform,
    );
    await measureInteraction(page, interactions, "move operation node", async () => {
      await dragNodeBy(page, operationNode, { x: 120, y: 80 });
    });
    await clickCanvasAction(page, "Undo");
    await flow.click({ position: { x: 600, y: 100 } });
    await expect
      .poll(() => operationNode.evaluate((element) => (element as HTMLElement).style.transform))
      .toBe(operationTransformBeforeMove);
    await clickCanvasAction(page, "Redo");

    await measureInteraction(page, interactions, "connect file to operation", async () => {
      await connectNodes(page, fileNode, operationNode);
      await expect(page.locator(".react-flow__edge")).toHaveCount(1);
    });

    await page.locator(".react-flow__edge-interaction").first().dispatchEvent("click");
    const edgeInspector = page.getByTestId("canvas-edge-inspector");
    await expect(edgeInspector).toBeVisible();
    await edgeInspector.getByTestId("canvas-edge-condition").fill("approved");
    await expect(edgeInspector.getByTestId("canvas-edge-condition")).toHaveValue("approved");
    await edgeInspector.getByTestId("canvas-edge-inspector-close").click();
    await expect(edgeInspector).toHaveCount(0);

    await Promise.all([
      page.waitForResponse(
        (response) => response.url().includes("pipelines.update") && response.ok(),
      ),
      page
        .getByTestId("canvas-top-chrome")
        .getByRole("button", { name: "Save", exact: true })
        .click(),
    ]);
    await expect(page.getByText("Pipeline saved")).toBeVisible();
    await page.reload();
    await page.waitForLoadState("networkidle");
    await startRenderingSample(page);
    await expect(page.locator(".react-flow__node-file")).toHaveCount(1);
    await expect(page.locator(".react-flow__node-operation")).toHaveCount(1);
    await expect(page.locator(".react-flow__edge")).toHaveCount(1);
    await page.locator(".react-flow__edge-interaction").first().dispatchEvent("click");
    await expect(page.getByTestId("canvas-edge-condition")).toHaveValue("approved");
    await page.getByTestId("canvas-edge-inspector-close").click();

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

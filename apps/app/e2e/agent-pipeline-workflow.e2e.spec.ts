import { expect, type Page, type Route, type TestInfo } from "@playwright/test";
import { test, navigateAndWait, expectNoJSErrors } from "./fixtures";

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    body: JSON.stringify(body),
    contentType: "application/json",
    status,
  });

const seedPipeline = async (page: Page, pipelineId: string, name: string) => {
  const response = await page.request.post("/api/trpc/pipelines.create?batch=1", {
    data: {
      0: {
        json: {
          pipeline: {
            id: pipelineId,
            name,
            description: "",
            sharedContext: "",
            tags: ["agent-control-e2e"],
            timeoutMs: null,
            nodes: [],
            edges: [],
          },
        },
      },
    },
  });
  expect(response.ok()).toBe(true);
};

const mockCanvasChangeSet = async (page: Page, pipelineId: string) => {
  const threadId = "canvas-change-set-thread";
  const runId = "canvas-change-set-run";
  const actionId = "canvas-change-set-action";
  const changeSetId = "canvas-change-set";
  const timestamp = "2026-08-25T00:00:00.000Z";
  const target = {
    type: "pipeline" as const,
    id: pipelineId,
    label: "Agent Canvas E2E",
  };
  const promptNode = {
    id: "agent-prompt-node",
    type: "prompt" as const,
    position: { x: 420, y: 260 },
    data: {
      nodeType: "prompt" as const,
      label: "Agent Prompt",
      prompt: "Review the repository",
    },
  };
  const forwardAction = { type: "addNode" as const, node: promptNode };
  const baseSnapshot = { nodes: [], edges: [] };
  const draftSnapshot = { nodes: [promptNode], edges: [] };
  const state = {
    context: null as unknown,
    ready: false,
    applied: false,
    rejected: false,
  };
  const currentStatus = () => {
    if (state.applied) return "committed" as const;
    if (state.rejected) return "rejected" as const;
    if (state.ready) return "ready" as const;

    return "drafting" as const;
  };
  const thread = () => ({
    id: threadId,
    title: "Build the Canvas step by step",
    actor: "local-owner" as const,
    status: "active" as const,
    activeContext: state.context,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  const changeSet = () => ({
    id: changeSetId,
    threadId,
    runId,
    actor: "local-owner" as const,
    kind: "agent-edit" as const,
    originChangeSetId: null,
    target,
    baseVersion: 1,
    revision: 1,
    appliedVersion: state.applied ? 2 : null,
    status: currentStatus(),
    baseSnapshot,
    draftSnapshot,
    createdAt: timestamp,
    updatedAt: timestamp,
    committedAt: state.applied ? timestamp : null,
  });
  const actionRecord = {
    id: actionId,
    threadId,
    runId,
    changeSetId,
    sequence: 1,
    toolName: "ordine.add_node",
    risk: "draft" as const,
    status: "succeeded" as const,
    target,
    redactedInput: { nodeId: promptNode.id },
    result: {
      actionId,
      status: "succeeded",
      resources: [target],
      summary: "Added prompt node",
      warnings: [],
    },
    forwardAction,
    inverseActions: [{ type: "removeNode" as const, nodeId: promptNode.id }],
    idempotencyKey: "canvas-change-set-e2e",
    createdAt: timestamp,
    completedAt: timestamp,
  };

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (pathname === "/api/agent-threads/capabilities" && request.method() === "GET") {
      await json(route, {
        enabled: true,
        toolContractVersion: 1,
        toolCount: 22,
        runtimes: [
          {
            runtimeConfigId: "local-codex",
            runtime: "codex",
            name: "Codex",
            supported: true,
            reason: "Verified MCP-only control mode",
            controlModel: "gpt-5.6-luna",
            controlReasoningEffort: "xhigh",
          },
        ],
      });

      return;
    }
    if (pathname === "/api/agent-threads" && request.method() === "GET") {
      await json(route, []);

      return;
    }
    if (pathname === "/api/agent-threads" && request.method() === "POST") {
      state.context = (request.postDataJSON() as { context: unknown }).context;
      await json(route, thread(), 201);

      return;
    }
    if (pathname === `/api/agent-threads/${threadId}` && request.method() === "PATCH") {
      state.context = (request.postDataJSON() as { context: unknown }).context;
      await json(route, thread());

      return;
    }
    if (pathname === `/api/agent-threads/${threadId}/messages` && request.method() === "GET") {
      await json(
        route,
        state.ready || state.applied || state.rejected
          ? [
              {
                id: "canvas-change-set-message",
                sessionId: threadId,
                role: "assistant",
                kind: "text",
                content: "The Canvas draft is ready to review.",
                context: state.context,
                runId,
                createdAt: timestamp,
              },
            ]
          : [],
      );

      return;
    }
    if (pathname === `/api/agent-threads/${threadId}/actions` && request.method() === "GET") {
      await json(route, state.ready || state.applied || state.rejected ? [actionRecord] : []);

      return;
    }
    if (pathname === `/api/agent-threads/${threadId}/change-sets` && request.method() === "GET") {
      await json(route, state.ready || state.applied || state.rejected ? [changeSet()] : []);

      return;
    }
    if (pathname === `/api/agent-threads/${threadId}/approvals` && request.method() === "GET") {
      await json(route, []);

      return;
    }
    if (pathname === `/api/agent-threads/${threadId}/runs/latest` && request.method() === "GET") {
      await route.fulfill({ status: 404 });

      return;
    }
    if (pathname === `/api/agent-threads/${threadId}/runs` && request.method() === "POST") {
      await json(route, { runId }, 202);

      return;
    }
    if (pathname === `/api/agent-runs/${runId}/events` && request.method() === "GET") {
      state.ready = true;
      const result = {
        actionId,
        status: "succeeded" as const,
        resources: [target],
        summary: "Added prompt node",
        warnings: [],
      };
      const events = [
        {
          runId,
          sequence: 1,
          createdAt: timestamp,
          event: {
            type: "action_started",
            runtime: "claude-code",
            timestamp,
            actionId,
            toolName: "ordine.add_node",
            risk: "draft",
            target,
            summary: "Adding a prompt node",
          },
        },
        {
          runId,
          sequence: 2,
          createdAt: timestamp,
          event: {
            type: "draft_applied",
            runtime: "claude-code",
            timestamp,
            actionId,
            changeSetId,
            pipelineId,
            action: forwardAction,
          },
        },
        {
          runId,
          sequence: 3,
          createdAt: timestamp,
          event: {
            type: "action_succeeded",
            runtime: "claude-code",
            timestamp,
            actionId,
            result,
          },
        },
        {
          runId,
          sequence: 4,
          createdAt: timestamp,
          event: {
            type: "change_set_ready",
            runtime: "claude-code",
            timestamp,
            changeSetId,
            target,
            baseVersion: 1,
            actionCount: 1,
            summary: "Canvas draft is ready",
          },
        },
        {
          runId,
          sequence: 5,
          createdAt: timestamp,
          event: {
            type: "terminal",
            runtime: "claude-code",
            timestamp,
            status: "completed",
          },
        },
      ];
      await route.fulfill({
        body: events
          .map((event) => `id: ${event.sequence}\ndata: ${JSON.stringify(event)}\n\n`)
          .join(""),
        contentType: "text/event-stream",
        status: 200,
      });

      return;
    }
    if (
      pathname === `/api/agent-threads/${threadId}/change-sets/${changeSetId}/apply` &&
      request.method() === "POST"
    ) {
      state.applied = true;
      state.ready = false;
      await json(route, {
        type: "applied",
        changeSet: changeSet(),
        previousVersion: 1,
        newVersion: 2,
      });

      return;
    }
    if (
      pathname === `/api/agent-threads/${threadId}/change-sets/${changeSetId}/reject` &&
      request.method() === "POST"
    ) {
      state.rejected = true;
      state.ready = false;
      await json(route, changeSet());

      return;
    }

    await route.fallback();
  });
};

const openSeededCanvas = async (page: Page, pipelineId: string) => {
  await mockCanvasChangeSet(page, pipelineId);
  await navigateAndWait(page, "/pipelines");
  await seedPipeline(page, pipelineId, "Agent Canvas E2E");
  await navigateAndWait(page, `/canvas?id=${pipelineId}`);
  await expect(page.getByTestId("canvas-agent-panel-shell")).toBeVisible();
};

const createDraft = async (page: Page) => {
  const panel = page.getByTestId("canvas-agent-panel-shell");
  await panel.getByTestId("agent-composer-input").fill("Add a prompt node for repository review");
  await panel.getByTestId("agent-composer-submit").click();
  await expect(page.locator(".react-flow__node-prompt")).toBeVisible();
  await expect(panel.getByTestId("agent-change-set")).toHaveAttribute("data-status", "ready");
  await expect(
    panel.getByTestId("agent-action").filter({ hasText: "ordine.add_node" }),
  ).toHaveAttribute("data-status", "succeeded");

  return panel;
};

test.describe("Canvas Agent Control Change Set workflow", () => {
  test.setTimeout(60_000);

  test("streams a draft node and applies the authoritative Change Set", async ({
    page,
    pageErrors,
  }, testInfo: TestInfo) => {
    const pipelineId = `agent-control-apply-${Date.now()}-${testInfo.workerIndex}`;
    await openSeededCanvas(page, pipelineId);
    const panel = await createDraft(page);

    await panel.getByTestId("agent-change-set-apply").click();
    await expect(panel.getByTestId("agent-change-set")).toHaveCount(0);
    await expect(page.locator(".react-flow__node-prompt")).toHaveCount(1);

    await page.getByTestId("canvas-component-object-file").click();
    await expect(page.locator(".react-flow__node")).toHaveCount(2);
    expectNoJSErrors(pageErrors);
  });

  test("rejects the draft, restores the base graph, and unlocks manual editing", async ({
    page,
    pageErrors,
  }, testInfo: TestInfo) => {
    const pipelineId = `agent-control-reject-${Date.now()}-${testInfo.workerIndex}`;
    await openSeededCanvas(page, pipelineId);
    const panel = await createDraft(page);

    await panel.getByTestId("agent-change-set-reject").click();
    await expect(panel.getByTestId("agent-change-set")).toHaveCount(0);
    await expect(page.locator(".react-flow__node-prompt")).toHaveCount(0);

    await page.getByTestId("canvas-component-object-file").click();
    await expect(page.locator(".react-flow__node-file")).toHaveCount(1);
    expectNoJSErrors(pageErrors);
  });
});

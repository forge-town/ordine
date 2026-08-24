import { expect, type Page, type Route } from "@playwright/test";
import { test, navigateAndWait, expectCanvasTitle, expectNoJSErrors } from "./fixtures";

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    body: JSON.stringify(body),
    contentType: "application/json",
    status,
  });

const makeProposal = (purpose: string) => ({
  mode: "generate" as const,
  purpose,
  inputs: ["Repository folder"],
  outputs: ["Markdown report"],
  majorOperations: ["Review repository"],
  executionFlow: ["Repository folder -> review -> report"],
  assumptions: ["Repository is locally available"],
  openQuestions: [],
  readiness: "ready_for_generation" as const,
});

const mockCanvasGeneration = async (
  page: Page,
  options: { generatedPipelineId: string; pipelineName: string },
) => {
  const sessionId = "canvas-generate-e2e-session";
  const proposalId = "canvas-generate-e2e-proposal";
  const proposal = makeProposal(options.pipelineName);
  const proposalState = { superseded: false };

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (pathname === "/api/pipeline-agent-sessions" && request.method() === "POST") {
      await json(route, {
        id: sessionId,
        entrypoint: "canvas-agent-panel",
        mode: "generate",
        status: "draft",
      });

      return;
    }
    if (pathname === `/api/pipeline-agent-sessions/${sessionId}` && request.method() === "GET") {
      await json(route, {
        id: sessionId,
        entrypoint: "canvas-agent-panel",
        mode: "generate",
        status: proposalState.superseded ? "draft" : "proposal_ready",
        latestProposalId: proposalState.superseded ? null : proposalId,
        createdPipelineId: null,
        attachments: [],
        messages: [
          {
            id: "canvas-generate-e2e-message",
            role: "user",
            kind: "text",
            content: "Build a review pipeline",
          },
        ],
        proposals: [
          {
            id: proposalId,
            mode: "generate",
            status: proposalState.superseded ? "superseded" : "proposal_ready",
            proposal,
          },
        ],
      });

      return;
    }
    if (pathname.endsWith("/messages") && request.method() === "POST") {
      const input = request.postDataJSON() as { content: string; kind: string; role: string };
      await json(route, { id: `canvas-generate-e2e-${Date.now()}`, ...input });

      return;
    }
    if (pathname.endsWith("/plan") && request.method() === "POST") {
      await route.fulfill({
        body: `event: proposal_ready\ndata: ${JSON.stringify({ proposal, proposalId })}\n\n`,
        contentType: "text/event-stream",
        status: 200,
      });

      return;
    }
    if (pathname.endsWith("/approve") && request.method() === "POST") {
      await route.fulfill({ status: 204 });

      return;
    }
    if (pathname.endsWith("/supersede") && request.method() === "POST") {
      proposalState.superseded = true;
      await route.fulfill({ status: 204 });

      return;
    }
    if (pathname.endsWith("/generate") && request.method() === "POST") {
      await json(route, { pipelineId: options.generatedPipelineId });

      return;
    }
    if (
      pathname === `/api/pipelines/${options.generatedPipelineId}` &&
      request.method() === "GET"
    ) {
      await json(route, {
        id: options.generatedPipelineId,
        name: options.pipelineName,
        description: "Generated through the Canvas Agent panel",
        sharedContext: "",
        tags: ["agent-generated"],
        timeoutMs: null,
        status: "draft",
        version: 1,
        nodes: [],
        edges: [],
        createdAt: "2026-08-11T00:00:00.000Z",
        updatedAt: "2026-08-11T00:00:00.000Z",
      });

      return;
    }

    await route.fallback();
  });
};

const startHomeGeneration = async (page: Page, purpose: string) => {
  await navigateAndWait(page, "/");
  await page
    .getByRole("textbox", { name: "Describe your goal and add any useful context..." })
    .fill(purpose);
  const sendButton = page.getByRole("button", { name: "Send" });
  await expect(sendButton).toBeEnabled({ timeout: 60_000 });
  await sendButton.click();
  await expect(page).toHaveURL(/\/canvas\?id=/);
  await expect(page.getByText(purpose, { exact: true })).toBeVisible();
  await expect(page.getByTestId("agent-proposal")).toBeVisible();
};

const seedPipeline = async (page: Page, pipelineId: string, name: string) => {
  const response = await page.request.post("/api/trpc/pipelines.create?batch=1", {
    data: {
      0: {
        json: {
          pipeline: {
            id: pipelineId,
            name,
            description: "Generated through the Canvas Agent panel",
            sharedContext: "",
            tags: ["e2e"],
            timeoutMs: null,
            status: "draft",
            version: 1,
            nodes: [],
            edges: [],
          },
        },
      },
    },
  });
  expect(response.ok()).toBe(true);
};

test.describe("Agent-first Pipeline workflow", () => {
  test.describe.configure({ timeout: 75_000 });

  test("plans, applies, materializes, and opens the generated Pipeline", async ({
    page,
    pageErrors,
  }, testInfo) => {
    const runId = `${Date.now()}-${testInfo.workerIndex}-${testInfo.repeatEachIndex}`;
    const pipelineName = `Agent Pipeline ${runId}`;
    const generatedPipelineId = `agent-pipeline-${runId}`;

    await mockCanvasGeneration(page, { generatedPipelineId, pipelineName });
    await startHomeGeneration(page, "Build a review pipeline");
    await seedPipeline(page, generatedPipelineId, pipelineName);

    await page.getByTestId("agent-proposal-apply").click();
    await expect(page).toHaveURL(new RegExp(`/canvas\\?id=${generatedPipelineId}$`));
    await expectCanvasTitle(page, pipelineName);
    expectNoJSErrors(pageErrors);
  });

  test("discards a generated Proposal and returns to the conversation", async ({
    page,
    pageErrors,
  }) => {
    const pipelineName = `Discardable pipeline ${Date.now()}`;
    await mockCanvasGeneration(page, {
      generatedPipelineId: `discarded-pipeline-${Date.now()}`,
      pipelineName,
    });
    await startHomeGeneration(page, "Build a review pipeline");
    await page.getByTestId("agent-proposal-reject").click();
    await expect(page.getByTestId("agent-proposal")).toHaveCount(0);
    await expect(page.getByRole("textbox", { name: "Message" })).toBeEnabled();
    expectNoJSErrors(pageErrors);
  });
});

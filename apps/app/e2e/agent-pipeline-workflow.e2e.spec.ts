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

const noop = () => undefined;

const mockPipelineAgent = async (page: Page, generatedPipelineId: string, pipelineName: string) => {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (pathname === "/api/pipeline-agent-sessions" && request.method() === "POST") {
      await json(route, {
        id: "e2e-session",
        entrypoint: "new-pipeline-dialog",
        mode: "generate",
        status: "draft",
      });

      return;
    }
    if (pathname.endsWith("/messages") && request.method() === "POST") {
      await json(route, {
        id: "e2e-message",
        role: "user",
        kind: "text",
        content: "Build a review pipeline",
      });

      return;
    }
    if (pathname.endsWith("/plan") && request.method() === "POST") {
      const proposal = makeProposal(pipelineName);
      await route.fulfill({
        body: `event: proposal_ready\ndata: ${JSON.stringify({ proposal, proposalId: "e2e-proposal" })}\n\n`,
        contentType: "text/event-stream",
        status: 200,
      });

      return;
    }
    if (pathname.endsWith("/approve") && request.method() === "POST") {
      await route.fulfill({ status: 204 });

      return;
    }
    if (pathname.endsWith("/generate") && request.method() === "POST") {
      await json(route, { pipelineId: generatedPipelineId });

      return;
    }
    if (pathname === `/api/pipelines/${generatedPipelineId}` && request.method() === "GET") {
      await json(route, {
        id: generatedPipelineId,
        name: pipelineName,
        description: "Generated through the Agent-first dialog",
        sharedContext: "",
        tags: ["agent-generated"],
        timeoutMs: null,
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

const startHomeConversation = async (page: Page, message = "Build a review pipeline") => {
  await navigateAndWait(page, "/");
  const composer = page.getByRole("textbox", {
    name: "Describe your goal and add any useful context...",
  });
  await composer.fill(message);
  await page.getByRole("button", { name: "Send" }).click();
};

test.describe("Agent-first Pipeline workflow", () => {
  test("plans, approves, materializes, and keeps the Pipeline in the active project", async ({
    page,
    pageErrors,
  }, testInfo) => {
    const runId = `${Date.now()}-${testInfo.workerIndex}-${testInfo.repeatEachIndex}`;
    const projectName = `Agent Project ${runId}`;
    const pipelineName = `Agent Pipeline ${runId}`;
    const pipelineId = `agent-pipeline-${runId}`;

    await page.addInitScript(() => globalThis.localStorage.setItem("i18nextLng", "en"));
    await mockPipelineAgent(page, pipelineId, pipelineName);
    await navigateAndWait(page, "/");
    await page.getByRole("button", { name: "Projects" }).click();
    await page.getByRole("menuitem", { name: "New project" }).click();
    await page.getByRole("textbox", { name: "Project name" }).fill(projectName);
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.getByRole("button", { name: "Projects" })).toContainText(projectName);

    await page.getByRole("button", { name: "New Pipeline" }).click();
    await page
      .getByPlaceholder("Describe your goal and add any useful context...")
      .fill("Build a review pipeline");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText(pipelineName, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Approve plan" }).click();
    await expect(page.getByText("Pipeline Ready")).toBeVisible();
    await page.getByRole("button", { name: "Open in Canvas" }).click();

    await expect(page).toHaveURL(new RegExp(`/canvas\\?id=${pipelineId}$`));
    await expectCanvasTitle(page, pipelineName);
    await navigateAndWait(page, "/pipelines");
    await expect(page.getByRole("button", { name: "Projects" })).toContainText(projectName);
    await expect(page.getByText(pipelineName, { exact: true })).toBeVisible();
    expectNoJSErrors(pageErrors);
  });

  test("recovers after a failed attachment upload", async ({ page, pageErrors }) => {
    const uploadState = { attempt: 0 };
    await page.route("http://localhost:9433/api/**", async (route) => {
      const request = route.request();
      const pathname = new URL(request.url()).pathname;
      if (pathname === "/api/pipeline-agent-sessions" && request.method() === "POST") {
        await json(route, {
          id: "upload-session",
          entrypoint: "new-pipeline-dialog",
          mode: "generate",
          status: "draft",
        });

        return;
      }
      if (pathname.endsWith("/attachments") && request.method() === "POST") {
        uploadState.attempt += 1;
        if (uploadState.attempt === 1) {
          await json(
            route,
            {
              code: "PIPELINE_AGENT_ATTACHMENT_UPLOAD_FAILED",
              error: "Storage unavailable",
            },
            500,
          );

          return;
        }
        await json(route, {
          attachment: {
            id: "attachment-retry",
            filename: "retry.txt",
            parseError: null,
            parseStatus: "parsed",
          },
        });

        return;
      }

      await route.abort("failed");
    });

    await navigateAndWait(page, "/");
    const upload = page.locator('input[type="file"][aria-label="Upload context"]');
    await upload.setInputFiles({
      buffer: Buffer.from("first"),
      mimeType: "text/plain",
      name: "failed.txt",
    });
    await expect(
      page.getByText("This attachment could not be uploaded. Check storage access and retry."),
    ).toBeVisible();

    await upload.setInputFiles({
      buffer: Buffer.from("second"),
      mimeType: "text/plain",
      name: "retry.txt",
    });
    await expect(page.getByText("retry.txt", { exact: true })).toBeVisible();
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    await expect(
      page.getByText("This attachment could not be uploaded. Check storage access and retry."),
    ).toHaveCount(0);
    expectNoJSErrors(pageErrors);
  });

  test("restores a pending Proposal after refresh", async ({ page, pageErrors }) => {
    const proposal = makeProposal("Restored review pipeline");
    await page.route("http://localhost:9433/api/**", async (route) => {
      const request = route.request();
      const pathname = new URL(request.url()).pathname;
      if (pathname === "/api/pipeline-agent-sessions" && request.method() === "POST") {
        await json(route, {
          id: "restore-session",
          entrypoint: "new-pipeline-dialog",
          mode: "generate",
          status: "draft",
        });

        return;
      }
      if (pathname.endsWith("/messages") && request.method() === "POST") {
        const input = request.postDataJSON() as { content: string; kind: string; role: string };
        await json(route, { id: "restore-message", ...input });

        return;
      }
      if (pathname.endsWith("/plan") && request.method() === "POST") {
        await route.fulfill({
          body: `event: proposal_ready\ndata: ${JSON.stringify({ proposal, proposalId: "restore-proposal" })}\n\n`,
          contentType: "text/event-stream",
          status: 200,
        });

        return;
      }
      if (
        pathname === "/api/pipeline-agent-sessions/restore-session" &&
        request.method() === "GET"
      ) {
        await json(route, {
          id: "restore-session",
          entrypoint: "new-pipeline-dialog",
          mode: "generate",
          status: "proposal_ready",
          latestProposalId: "restore-proposal",
          createdPipelineId: null,
          attachments: [],
          messages: [
            {
              id: "restore-message",
              role: "user",
              kind: "text",
              content: "Build a review pipeline",
            },
          ],
          proposals: [
            {
              id: "restore-proposal",
              mode: "generate",
              status: "proposal_ready",
              proposal,
            },
          ],
        });

        return;
      }

      await route.abort("failed");
    });

    await startHomeConversation(page);
    await expect(page.getByText("Restored review pipeline", { exact: true })).toBeVisible();
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Restored review pipeline", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve plan" })).toBeEnabled();
    expectNoJSErrors(pageErrors);
  });

  test("cancels planning and returns to an editable conversation", async ({ page, pageErrors }) => {
    const cancellation = { completed: false };
    await page.route("http://localhost:9433/api/**", async (route) => {
      const request = route.request();
      const pathname = new URL(request.url()).pathname;
      if (pathname === "/api/pipeline-agent-sessions" && request.method() === "POST") {
        await json(route, {
          id: "planning-cancel-session",
          entrypoint: "new-pipeline-dialog",
          mode: "generate",
          status: "draft",
        });

        return;
      }
      if (pathname.endsWith("/messages") && request.method() === "POST") {
        const input = request.postDataJSON() as { content: string; kind: string; role: string };
        await json(route, { id: "planning-message", ...input });

        return;
      }
      if (pathname.endsWith("/plan") && request.method() === "POST") {
        await route.fulfill({
          body: `event: phase\ndata: ${JSON.stringify({ phase: "planning" })}\n\n`,
          contentType: "text/event-stream",
          status: 200,
        });

        return;
      }
      if (pathname === "/api/pipeline-agent-sessions/planning-cancel-session") {
        await json(route, {
          id: "planning-cancel-session",
          entrypoint: "new-pipeline-dialog",
          mode: "generate",
          status: "draft",
          attachments: [],
          messages: [],
          proposals: [],
        });

        return;
      }
      if (pathname.endsWith("/cancel") && request.method() === "POST") {
        cancellation.completed = true;
        await route.fulfill({ status: 204 });

        return;
      }

      await route.abort("failed");
    });

    await startHomeConversation(page);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect.poll(() => cancellation.completed).toBe(true);
    await expect(
      page.getByRole("textbox", { name: "Describe your goal and add any useful context..." }),
    ).toBeEnabled();
    await expect(page.getByRole("button", { name: "Cancel", exact: true })).toHaveCount(0);
    expectNoJSErrors(pageErrors);
  });

  test("cancels generation and keeps the Proposal ready to approve again", async ({
    page,
    pageErrors,
  }) => {
    const proposal = makeProposal("Cancelable pipeline");
    const generationControl: { markStarted: () => void; release: () => void } = {
      markStarted: noop,
      release: noop,
    };
    const generationStarted = new Promise<void>((resolve) => {
      generationControl.markStarted = resolve;
    });
    await page.route("http://localhost:9433/api/**", async (route) => {
      const request = route.request();
      const pathname = new URL(request.url()).pathname;
      if (pathname === "/api/pipeline-agent-sessions" && request.method() === "POST") {
        await json(route, {
          id: "generation-cancel-session",
          entrypoint: "new-pipeline-dialog",
          mode: "generate",
          status: "draft",
        });

        return;
      }
      if (pathname.endsWith("/messages") && request.method() === "POST") {
        const input = request.postDataJSON() as { content: string; kind: string; role: string };
        await json(route, { id: "generation-message", ...input });

        return;
      }
      if (pathname.endsWith("/plan") && request.method() === "POST") {
        await route.fulfill({
          body: `event: proposal_ready\ndata: ${JSON.stringify({ proposal, proposalId: "generation-proposal" })}\n\n`,
          contentType: "text/event-stream",
          status: 200,
        });

        return;
      }
      if (pathname.endsWith("/approve") && request.method() === "POST") {
        await route.fulfill({ status: 204 });

        return;
      }
      if (pathname.endsWith("/generate") && request.method() === "POST") {
        generationControl.markStarted();
        await new Promise<void>((resolve) => {
          generationControl.release = resolve;
        });
        await json(route, { pipelineId: "cancelled-pipeline" }).catch(() => undefined);

        return;
      }
      if (pathname.endsWith("/cancel") && request.method() === "POST") {
        generationControl.release();
        await route.fulfill({ status: 204 });

        return;
      }

      await route.abort("failed");
    });

    await startHomeConversation(page);
    await expect(page.getByText("Cancelable pipeline", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Approve plan" }).click();
    await generationStarted;
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByRole("button", { name: "Approve plan" })).toBeEnabled();
    expectNoJSErrors(pageErrors);
  });
});

import { expect, type Page, type Route } from "@playwright/test";
import { test, navigateAndWait, expectNoJSErrors } from "./fixtures";

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    body: JSON.stringify(body),
    contentType: "application/json",
    status,
  });

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
      const proposal = {
        mode: "generate",
        purpose: pipelineName,
        inputs: ["Repository folder"],
        outputs: ["Markdown report"],
        majorOperations: ["Review repository"],
        executionFlow: ["Repository folder -> review -> report"],
        assumptions: ["Repository is locally available"],
        openQuestions: [],
        readiness: "ready_for_generation",
      };
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
    await expect(page.getByRole("textbox", { name: "Pipeline title" })).toHaveValue(pipelineName);
    await navigateAndWait(page, "/pipelines");
    await expect(page.getByRole("button", { name: "Projects" })).toContainText(projectName);
    await expect(page.getByText(pipelineName, { exact: true })).toBeVisible();
    expectNoJSErrors(pageErrors);
  });
});

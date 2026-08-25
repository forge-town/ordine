import { Hono } from "hono";
import { err } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  generateStructure: vi.fn(),
  getById: vi.fn(),
  proposeActions: vi.fn(),
  startRun: vi.fn(),
}));

vi.mock("../../src/services.js", () => ({
  pipelinesService: {
    getAll: vi.fn(),
    getById: mocks.getById,
    create: mocks.create,
    update: vi.fn(),
    delete: vi.fn(),
    generateStructure: mocks.generateStructure,
    proposeActions: mocks.proposeActions,
  },
  pipelineRunnerService: {
    startRun: mocks.startRun,
  },
}));

import { pipelinesRoutes } from "../../src/routes/pipelines";

const makeApp = () => {
  const app = new Hono();
  app.route("/pipelines", pipelinesRoutes);

  return app;
};

describe("pipelinesRoutes", () => {
  beforeEach(() => {
    mocks.create.mockReset();
    mocks.generateStructure.mockReset();
    mocks.proposeActions.mockReset();
    mocks.startRun.mockReset();
    mocks.getById.mockReset();
  });

  it("rejects saving a Pipeline that references a missing Operation", async () => {
    const missingOperationError = Object.assign(
      new Error('Pipeline p1 references missing Operation "op-missing" at node "operation-node"'),
      {
        code: "PIPELINE_OPERATION_MISSING",
        pipelineId: "p1",
        missingOperations: [{ nodeId: "operation-node", operationId: "op-missing" }],
      },
    );
    mocks.create.mockResolvedValue(err(missingOperationError));

    const response = await makeApp().request("/pipelines", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: "p1",
        name: "Broken Pipeline",
        nodes: [],
        edges: [],
      }),
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      code: "PIPELINE_OPERATION_MISSING",
      error: 'Pipeline p1 references missing Operation "op-missing" at node "operation-node"',
      pipelineId: "p1",
      missingOperations: [{ nodeId: "operation-node", operationId: "op-missing" }],
    });
  });

  it("returns 400 when generate-structure receives invalid JSON", async () => {
    const response = await makeApp().request("/pipelines/generate-structure", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    });

    expect(response.status).toBe(400);
    expect(mocks.generateStructure).not.toHaveBeenCalled();
  });

  it("rejects blank runtime and model selections for generate-structure", async () => {
    const response = await makeApp().request("/pipelines/generate-structure", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Review",
        description: "Review code",
        runtimeId: " ",
        model: "",
      }),
    });

    expect(response.status).toBe(400);
    expect(mocks.generateStructure).not.toHaveBeenCalled();
  });

  it("forwards validated runtime and model selections to generate-structure", async () => {
    mocks.generateStructure.mockResolvedValue({ nodes: [], edges: [] });
    const body = {
      name: "Review",
      description: "Review code",
      unmatchedSteps: [{ step: "Review code", reason: "No matching operation" }],
      runtimeId: "runtime-codex",
      model: "gpt-review",
    };

    const response = await makeApp().request("/pipelines/generate-structure", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    expect(response.status).toBe(200);
    expect(mocks.generateStructure).toHaveBeenCalledWith(body);
  });

  it("returns 400 when propose-actions receives invalid JSON", async () => {
    const response = await makeApp().request("/pipelines/p1/propose-actions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid request body" });
    expect(mocks.proposeActions).not.toHaveBeenCalled();
  });

  it("returns 400 when propose-actions receives an invalid snapshot", async () => {
    const response = await makeApp().request("/pipelines/p1/propose-actions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ snapshot: null, message: "add node" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid request body" });
    expect(mocks.proposeActions).not.toHaveBeenCalled();
  });

  it("returns 400 when propose-actions receives a blank message", async () => {
    const response = await makeApp().request("/pipelines/p1/propose-actions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ snapshot: { nodes: [], edges: [] }, message: "   " }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid request body" });
    expect(mocks.proposeActions).not.toHaveBeenCalled();
  });

  it("forwards valid propose-actions requests to the service", async () => {
    const responseBody = { proposal: null, diagnostics: [] };
    mocks.proposeActions.mockResolvedValue(responseBody);

    const snapshot = { nodes: [], edges: [] };
    const response = await makeApp().request("/pipelines/p1/propose-actions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        snapshot,
        message: "add node",
        pipelineName: "Pipeline 1",
        runtimeId: "runtime-codex",
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(responseBody);
    expect(mocks.proposeActions).toHaveBeenCalledWith({
      pipelineId: "p1",
      snapshot,
      message: "add node",
      pipelineName: "Pipeline 1",
      runtimeId: "runtime-codex",
    });
  });

  it("preserves attachment content when forwarding propose-actions", async () => {
    mocks.proposeActions.mockResolvedValue({ proposal: null, diagnostics: [] });
    const attachment = {
      name: "context.txt",
      type: "text/plain",
      content: "full attachment body",
    };

    const response = await makeApp().request("/pipelines/p1/propose-actions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        attachments: [attachment],
        snapshot: { nodes: [], edges: [] },
        message: "use this context",
      }),
    });

    expect(response.status).toBe(200);
    expect(mocks.proposeActions).toHaveBeenCalledWith({
      pipelineId: "p1",
      attachments: [attachment],
      snapshot: { nodes: [], edges: [] },
      message: "use this context",
    });
  });

  it("forwards the selected runtime and model to a Pipeline run", async () => {
    mocks.getById.mockResolvedValue({ id: "p1" });
    mocks.startRun.mockResolvedValue({
      isErr: () => false,
      value: { jobId: "job-1" },
    });

    const response = await makeApp().request("/pipelines/p1/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        runtimeConfigId: "local-codex",
        model: "gpt-5.6-luna",
        reasoningEffort: "high",
        speed: "priority",
      }),
    });

    expect(response.status).toBe(202);
    expect(mocks.startRun).toHaveBeenCalledWith({
      pipelineId: "p1",
      inputPath: undefined,
      githubToken: undefined,
      inputs: undefined,
      runtimeConfigId: "local-codex",
      model: "gpt-5.6-luna",
      reasoningEffort: "high",
      speed: "priority",
    });
  });

  it("returns a stable conflict when a Pipeline run has no configured runtime", async () => {
    const runtimeError = Object.assign(
      new Error("No configured Agent runtime is available for this Pipeline run"),
      { code: "AGENT_RUNTIME_NOT_FOUND" },
    );
    mocks.getById.mockResolvedValue({ id: "p1" });
    mocks.startRun.mockResolvedValue(err(runtimeError));

    const response = await makeApp().request("/pipelines/p1/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      code: "AGENT_RUNTIME_NOT_FOUND",
      error: "No configured Agent runtime is available for this Pipeline run",
    });
  });

  it("returns missing Operation details before starting a Pipeline run", async () => {
    const missingOperationError = Object.assign(
      new Error(
        'Pipeline p1 references missing Operation "op_new_search_hackathons" at node "search-node"',
      ),
      {
        code: "PIPELINE_OPERATION_MISSING",
        pipelineId: "p1",
        missingOperations: [{ nodeId: "search-node", operationId: "op_new_search_hackathons" }],
      },
    );
    mocks.getById.mockResolvedValue({ id: "p1" });
    mocks.startRun.mockResolvedValue(err(missingOperationError));

    const response = await makeApp().request("/pipelines/p1/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      code: "PIPELINE_OPERATION_MISSING",
      error:
        'Pipeline p1 references missing Operation "op_new_search_hackathons" at node "search-node"',
      pipelineId: "p1",
      missingOperations: [{ nodeId: "search-node", operationId: "op_new_search_hackathons" }],
    });
  });
});

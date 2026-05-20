import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  proposeActions: vi.fn(),
  startRun: vi.fn(),
}));

vi.mock("../../src/services.js", () => ({
  pipelinesService: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
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

describe("pipelinesRoutes propose-actions", () => {
  beforeEach(() => {
    mocks.proposeActions.mockReset();
    mocks.startRun.mockReset();
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
});

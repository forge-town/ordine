import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  startRun: vi.fn(),
  pauseRun: vi.fn(),
  resumeRun: vi.fn(),
  cancelRun: vi.fn(),
  runNow: vi.fn(),
  create: vi.fn(),
  updateStatus: vi.fn(),
  getAll: vi.fn(),
}));

vi.mock("../../src/services.js", () => ({
  jobsService: { create: mocks.create, updateStatus: mocks.updateStatus, getAll: mocks.getAll },
  pipelinesService: {},
  operationsService: {},
  routinesService: { runNow: mocks.runNow },
  pipelineRunnerService: mocks,
  operationRunnerService: { startRun: mocks.startRun },
}));

import { jobsRoutes } from "../../src/routes/jobs";
import { operationsRoutes } from "../../src/routes/operations";
import { pipelinesRoutes } from "../../src/routes/pipelines";
import { routinesRoutes } from "../../src/routes/routines";

// Deliberately omit app.ts middleware and mount under a different prefix.
const app = new Hono()
  .route("/legacy/jobs", jobsRoutes)
  .route("/legacy/operations", operationsRoutes)
  .route("/legacy/pipelines", pipelinesRoutes)
  .route("/legacy/routines", routinesRoutes);

describe("legacy execution handlers", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ["POST", "/legacy/jobs"],
    ["PATCH", "/legacy/jobs/job-1"],
    ["POST", "/legacy/jobs/job-1/pause"],
    ["POST", "/legacy/jobs/job-1/resume"],
    ["POST", "/legacy/jobs/job-1/cancel"],
    ["POST", "/legacy/operations/op-1/run"],
    ["POST", "/legacy/pipelines/pipeline-1/run"],
    ["POST", "/legacy/routines/routine-1/run-now"],
  ])("disables %s %s without middleware or body parsing", async (method, path) => {
    const response = await app.request(path, { method, body: "invalid-json" });
    expect(response.status).toBe(410);
    expect(await response.json()).toMatchObject({ code: "NOT_SUPPORTED" });
    for (const call of Object.values(mocks)) expect(call).not.toHaveBeenCalled();
  });

  it("keeps historical job reads available", async () => {
    mocks.getAll.mockResolvedValue([{ id: "historical-job" }]);
    const response = await app.request("/legacy/jobs");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([{ id: "historical-job" }]);
  });
});

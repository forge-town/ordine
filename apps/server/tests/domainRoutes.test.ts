import { beforeEach, describe, expect, it, vi } from "vitest";
import { err, ok } from "neverthrow";

vi.hoisted(() => {
  process.env.ORDINE_AGENT_API_TOKEN = "test-agent-api-token-that-is-long-enough";
});

const mocks = vi.hoisted(() => ({
  connectorsConnect: vi.fn(),
  connectorsGetAll: vi.fn(),
  conversationsClearAll: vi.fn(),
  conversationsGetAll: vi.fn(),
  jobsCancel: vi.fn(),
  jobsPause: vi.fn(),
  jobsResume: vi.fn(),
  pipelineAssetsGetAll: vi.fn(),
  pipelineAssetsGetUsageCount: vi.fn(),
  projectsGetAll: vi.fn(),
  routinesGetByPipelineId: vi.fn(),
  routinesGetAll: vi.fn(),
  routinesRunNow: vi.fn(),
  usageGetDailyTokenSeries: vi.fn(),
  usageGetSummary: vi.fn(),
}));

vi.mock("../src/services.js", () => ({
  agentsService: {},
  connectorsService: {
    connect: mocks.connectorsConnect,
    getAll: mocks.connectorsGetAll,
  },
  conversationMessagesService: {
    clearAll: mocks.conversationsClearAll,
    getAll: mocks.conversationsGetAll,
  },
  distillationsService: {},
  jobsService: {},
  listDirectory: vi.fn(),
  operationsService: {},
  operationRunnerService: {},
  pipelineAgentSessionsService: {},
  pipelineAssetsService: {
    getAll: mocks.pipelineAssetsGetAll,
    getUsageCount: mocks.pipelineAssetsGetUsageCount,
  },
  pipelineRunnerService: {
    cancelRun: mocks.jobsCancel,
    pauseRun: mocks.jobsPause,
    resumeRun: mocks.jobsResume,
  },
  pipelinesService: {},
  projectsService: { getAll: mocks.projectsGetAll },
  routinesService: {
    getAll: mocks.routinesGetAll,
    getByPipelineId: mocks.routinesGetByPipelineId,
    runNow: mocks.routinesRunNow,
  },
  skillsService: {},
  usageService: {
    getDailyTokenSeries: mocks.usageGetDailyTokenSeries,
    getSummary: mocks.usageGetSummary,
  },
}));

import { app } from "../src/app.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.connectorsConnect.mockResolvedValue(ok({ id: "connector-1" }));
  mocks.connectorsGetAll.mockResolvedValue(ok([]));
  mocks.conversationsClearAll.mockResolvedValue(ok(undefined));
  mocks.conversationsGetAll.mockResolvedValue(ok([]));
  mocks.jobsCancel.mockResolvedValue(ok({ cancelled: true, jobId: "job-1" }));
  mocks.jobsPause.mockResolvedValue(ok({ jobId: "job-1", paused: true }));
  mocks.jobsResume.mockResolvedValue(ok({ jobId: "job-1", resumed: true }));
  mocks.pipelineAssetsGetAll.mockResolvedValue(ok([]));
  mocks.pipelineAssetsGetUsageCount.mockResolvedValue(ok({ assetId: "asset-1", count: 1 }));
  mocks.projectsGetAll.mockResolvedValue(ok([]));
  mocks.routinesGetAll.mockResolvedValue([]);
  mocks.routinesGetByPipelineId.mockResolvedValue([]);
  mocks.routinesRunNow.mockResolvedValue(ok({ jobId: "job-1" }));
  mocks.usageGetDailyTokenSeries.mockResolvedValue(ok([]));
  mocks.usageGetSummary.mockResolvedValue(ok({ runCount: 0, totalTokens: 0 }));
});

describe("domain REST routes", () => {
  it.each([
    ["/api/connectors", mocks.connectorsGetAll],
    ["/api/conversations", mocks.conversationsGetAll],
    ["/api/pipeline-assets", mocks.pipelineAssetsGetAll],
    ["/api/projects", mocks.projectsGetAll],
    ["/api/routines", mocks.routinesGetAll],
  ])("registers GET %s", async (path, serviceCall) => {
    const response = await app.request(path, {
      headers: path === "/api/connectors" ? authorizedHeaders : undefined,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    expect(serviceCall).toHaveBeenCalledOnce();
  });

  it("starts a routine immediately", async () => {
    const response = await app.request("/api/routines/routine-1/run-now", {
      method: "POST",
    });

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ jobId: "job-1" });
    expect(mocks.routinesRunNow).toHaveBeenCalledWith("routine-1");
  });

  it.each([
    ["pause", mocks.jobsPause, { jobId: "job-1", paused: true }],
    ["resume", mocks.jobsResume, { jobId: "job-1", resumed: true }],
    ["cancel", mocks.jobsCancel, { cancelled: true, jobId: "job-1" }],
  ])("%ss a job", async (action, serviceCall, body) => {
    const response = await app.request(`/api/jobs/job-1/${action}`, { method: "POST" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(body);
    expect(serviceCall).toHaveBeenCalledWith("job-1");
  });

  it.each([
    ["JobNotFoundError", 404],
    ["InvalidJobStatusError", 409],
  ])("maps %s from a job action to %i", async (name, status) => {
    const error = new Error("Job action failed");
    error.name = name;
    mocks.jobsPause.mockResolvedValueOnce(err(error));

    const response = await app.request("/api/jobs/job-1/pause", { method: "POST" });

    expect(response.status).toBe(status);
  });

  it("maps a missing routine run to 404", async () => {
    const notFound = new Error("Routine:missing not found");
    notFound.name = "NotFoundError";
    mocks.routinesRunNow.mockResolvedValue(err(notFound));

    const response = await app.request("/api/routines/missing/run-now", { method: "POST" });

    expect(response.status).toBe(404);
    expect(mocks.routinesRunNow).toHaveBeenCalledWith("missing");
  });

  it("filters pipeline routines by enabled status", async () => {
    mocks.routinesGetByPipelineId.mockResolvedValue([
      { id: "enabled", enabled: true },
      { id: "disabled", enabled: false },
    ]);

    const response = await app.request("/api/routines?pipelineId=p1&enabled=true");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([{ id: "enabled", enabled: true }]);
  });

  it("exposes current connector and conversation actions", async () => {
    const connectResponse = await app.request("/api/connectors/connector-1/connect", {
      method: "POST",
      headers: authorizedHeaders,
    });
    const clearResponse = await app.request("/api/conversations", { method: "DELETE" });

    expect(connectResponse.status).toBe(200);
    expect(await connectResponse.json()).toEqual({ id: "connector-1" });
    expect(clearResponse.status).toBe(204);
    expect(mocks.connectorsConnect).toHaveBeenCalledWith("connector-1");
    expect(mocks.conversationsClearAll).toHaveBeenCalledOnce();
  });

  it("rejects unauthenticated connector access before spawning a connector", async () => {
    const response = await app.request("/api/connectors/connector-1/connect", {
      method: "POST",
    });

    expect(response.status).toBe(401);
    expect(mocks.connectorsConnect).not.toHaveBeenCalled();
  });

  it("rejects limit without pipelineId instead of silently ignoring it", async () => {
    const response = await app.request("/api/conversations?limit=1");

    expect(response.status).toBe(400);
    expect(mocks.conversationsGetAll).not.toHaveBeenCalled();
  });

  it("returns pipeline asset usage counts", async () => {
    const response = await app.request("/api/pipeline-assets/asset-1/usage-count");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ assetId: "asset-1", count: 1 });
    expect(mocks.pipelineAssetsGetUsageCount).toHaveBeenCalledWith("asset-1");
  });

  it("exposes token-only usage endpoints", async () => {
    const query = "from=2026-07-01T00:00:00.000Z&to=2026-07-31T00:00:00.000Z";
    const summaryResponse = await app.request(`/api/usage/summary?${query}`);
    const dailyResponse = await app.request(`/api/usage/daily-token-series?${query}`);

    expect(summaryResponse.status).toBe(200);
    expect(await summaryResponse.json()).toEqual({ runCount: 0, totalTokens: 0 });
    expect(dailyResponse.status).toBe(200);
    expect(await dailyResponse.json()).toEqual([]);
    expect(mocks.usageGetSummary).toHaveBeenCalledOnce();
    expect(mocks.usageGetDailyTokenSeries).toHaveBeenCalledOnce();
  });
});

const authorizedHeaders = {
  Authorization: "Bearer test-agent-api-token-that-is-long-enough",
};

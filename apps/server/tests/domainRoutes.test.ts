import { beforeEach, describe, expect, it, vi } from "vitest";
import { ok } from "neverthrow";

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
  routinesGetOccurrences: vi.fn(),
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
    getOccurrences: mocks.routinesGetOccurrences,
    runNow: mocks.routinesRunNow,
  },
  skillsService: {},
  usageService: {
    getDailyTokenSeries: mocks.usageGetDailyTokenSeries,
    getSummary: mocks.usageGetSummary,
  },
}));

vi.mock("../src/routes/productMetadataRoutes", async () => {
  const { Hono } = await import("hono");

  return { productMetadataRoutes: new Hono() };
});

import { app } from "../src/app.js";
const request = (path: string, init?: RequestInit) => {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", "Bearer test-agent-api-token-that-is-long-enough");

  return app.request(path, { ...init, headers });
};

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
  mocks.routinesGetOccurrences.mockResolvedValue({
    occurrences: [],
    timeZone: "UTC",
    truncated: false,
  });
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
    const response = await request(path, {
      headers: path === "/api/connectors" ? authorizedHeaders : undefined,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    expect(serviceCall).toHaveBeenCalledOnce();
  });

  it("disables immediate legacy routine execution", async () => {
    const response = await request("/api/routines/routine-1/run-now", { method: "POST" });
    expect(response.status).toBe(410);
    expect(mocks.routinesRunNow).not.toHaveBeenCalled();
  });

  it("returns routine occurrences expanded in the server timezone", async () => {
    const response = await request(
      "/api/routines/occurrences?from=2026-08-03T00%3A00%3A00.000Z&to=2026-08-10T00%3A00%3A00.000Z",
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      occurrences: [],
      timeZone: "UTC",
      truncated: false,
    });
    expect(mocks.routinesGetOccurrences).toHaveBeenCalledWith(
      new Date("2026-08-03T00:00:00.000Z"),
      new Date("2026-08-10T00:00:00.000Z"),
    );
  });

  it.each([
    ["pause", mocks.jobsPause],
    ["resume", mocks.jobsResume],
    ["cancel", mocks.jobsCancel],
  ])("disables legacy job %s", async (action, serviceCall) => {
    const response = await request(`/api/jobs/job-1/${action}`, { method: "POST" });
    expect(response.status).toBe(410);
    expect(serviceCall).not.toHaveBeenCalled();
  });

  it("filters pipeline routines by enabled status", async () => {
    mocks.routinesGetByPipelineId.mockResolvedValue([
      { id: "enabled", enabled: true },
      { id: "disabled", enabled: false },
    ]);

    const response = await request("/api/routines?pipelineId=p1&enabled=true");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([{ id: "enabled", enabled: true }]);
  });

  it("exposes current connector and conversation actions", async () => {
    const connectResponse = await request("/api/connectors/connector-1/connect", {
      method: "POST",
      headers: authorizedHeaders,
    });
    const clearResponse = await request("/api/conversations", { method: "DELETE" });

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
    const response = await request("/api/conversations?limit=1");

    expect(response.status).toBe(400);
    expect(mocks.conversationsGetAll).not.toHaveBeenCalled();
  });

  it("returns pipeline asset usage counts", async () => {
    const response = await request("/api/pipeline-assets/asset-1/usage-count");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ assetId: "asset-1", count: 1 });
    expect(mocks.pipelineAssetsGetUsageCount).toHaveBeenCalledWith("asset-1");
  });

  it("exposes token-only usage endpoints", async () => {
    const query = "from=2026-07-01T00:00:00.000Z&to=2026-07-31T00:00:00.000Z";
    const summaryResponse = await request(`/api/usage/summary?${query}`);
    const dailyResponse = await request(`/api/usage/daily-token-series?${query}`);

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

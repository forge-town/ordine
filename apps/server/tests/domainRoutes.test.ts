import { beforeEach, describe, expect, it, vi } from "vitest";
import { ok } from "neverthrow";

const mocks = vi.hoisted(() => ({
  connectorsConnect: vi.fn(),
  connectorsGetAll: vi.fn(),
  conversationsClearAll: vi.fn(),
  conversationsGetAll: vi.fn(),
  pipelineAssetsGetAll: vi.fn(),
  pipelineAssetsGetUsageCount: vi.fn(),
  projectsGetAll: vi.fn(),
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
  pipelineRunnerService: {},
  pipelinesService: {},
  projectsService: { getAll: mocks.projectsGetAll },
  routinesService: {
    getAll: mocks.routinesGetAll,
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
  mocks.pipelineAssetsGetAll.mockResolvedValue(ok([]));
  mocks.pipelineAssetsGetUsageCount.mockResolvedValue(ok({ assetId: "asset-1", count: 1 }));
  mocks.projectsGetAll.mockResolvedValue(ok([]));
  mocks.routinesGetAll.mockResolvedValue([]);
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
    const response = await app.request(path);

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

  it("exposes current connector and conversation actions", async () => {
    const connectResponse = await app.request("/api/connectors/connector-1/connect", {
      method: "POST",
    });
    const clearResponse = await app.request("/api/conversations", { method: "DELETE" });

    expect(connectResponse.status).toBe(200);
    expect(await connectResponse.json()).toEqual({ id: "connector-1" });
    expect(clearResponse.status).toBe(204);
    expect(mocks.connectorsConnect).toHaveBeenCalledWith("connector-1");
    expect(mocks.conversationsClearAll).toHaveBeenCalledOnce();
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

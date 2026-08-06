import { beforeEach, describe, expect, it, vi } from "vitest";
import { err, ok } from "neverthrow";

vi.hoisted(() => {
  process.env.BETTER_AUTH_SECRET = "test-secret";
  process.env.PGLITE_DATA_DIR = "/tmp/ordine-cod-122-test";
});

const mocks = vi.hoisted(() => ({
  connectorsConnect: vi.fn(),
  connectorsGetAll: vi.fn(),
  conversationsClearAll: vi.fn(),
  conversationsGetAll: vi.fn(),
  pipelineAssetsGetAll: vi.fn(),
  pipelineAssetsGetUsageCount: vi.fn(),
  pipelineCancelRun: vi.fn(),
  projectsGetAll: vi.fn(),
  routinesGetByPipelineId: vi.fn(),
  routinesGetAll: vi.fn(),
  routinesRunNow: vi.fn(),
  usageGetDailyTokenSeries: vi.fn(),
}));

vi.mock("./services", () => ({
  agentRuntimesService: {},
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
  githubProjectsService: {},
  jobsService: {},
  operationOutputItemTemplatesService: {},
  operationRunnerService: {},
  operationsService: {},
  pipelineAssetsService: {
    getAll: mocks.pipelineAssetsGetAll,
    getUsageCount: mocks.pipelineAssetsGetUsageCount,
  },
  pipelineRunnerService: { cancelRun: mocks.pipelineCancelRun },
  pipelinesService: {},
  projectsService: { getAll: mocks.projectsGetAll },
  refinementsService: {},
  routinesService: {
    getAll: mocks.routinesGetAll,
    getByPipelineId: mocks.routinesGetByPipelineId,
    runNow: mocks.routinesRunNow,
  },
  settingsService: {},
  skillsService: {},
  usageService: { getDailyTokenSeries: mocks.usageGetDailyTokenSeries },
}));
vi.mock("@repo/services", () => ({
  getProposeProgress: vi.fn(),
  setProposeProgress: vi.fn(),
}));

import { router } from "./init";
import { connectorsRouter } from "./routers/connectors";
import { conversationsRouter } from "./routers/conversations";
import { pipelineAssetsRouter } from "./routers/pipelineAssets";
import { pipelinesRouter } from "./routers/pipelines";
import { projectsRouter } from "./routers/projects";
import { routinesRouter } from "./routers/routines";
import { usageRouter } from "./routers/usage";

const domainRouter = router({
  connectors: connectorsRouter,
  conversations: conversationsRouter,
  pipelineAssets: pipelineAssetsRouter,
  pipelines: pipelinesRouter,
  projects: projectsRouter,
  routines: routinesRouter,
  usage: usageRouter,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.connectorsConnect.mockResolvedValue(ok({ id: "connector-1" }));
  mocks.connectorsGetAll.mockResolvedValue(ok([]));
  mocks.conversationsClearAll.mockResolvedValue(ok(undefined));
  mocks.conversationsGetAll.mockResolvedValue(ok([]));
  mocks.pipelineAssetsGetAll.mockResolvedValue(ok([]));
  mocks.pipelineAssetsGetUsageCount.mockResolvedValue(ok({ assetId: "asset-1", count: 1 }));
  mocks.pipelineCancelRun.mockResolvedValue(ok({ cancelled: true, jobId: "job-1" }));
  mocks.projectsGetAll.mockResolvedValue(ok([]));
  mocks.routinesGetAll.mockResolvedValue([]);
  mocks.routinesGetByPipelineId.mockResolvedValue([]);
  mocks.routinesRunNow.mockResolvedValue(ok({ jobId: "job-1" }));
  mocks.usageGetDailyTokenSeries.mockResolvedValue(ok([]));
});

describe("domain tRPC routers", () => {
  it("exposes the newly added service procedures", async () => {
    const caller = domainRouter.createCaller({ session: null });
    const authedCaller = domainRouter.createCaller({ session: { user: { id: "user-1" } } });

    await expect(caller.connectors.getMany()).resolves.toEqual([]);
    await expect(caller.conversations.getMany()).resolves.toEqual([]);
    await expect(caller.pipelineAssets.getMany()).resolves.toEqual([]);
    await expect(caller.projects.getMany()).resolves.toEqual([]);
    await expect(caller.routines.getMany()).resolves.toEqual([]);
    await expect(caller.routines.runNow({ id: "routine-1" })).resolves.toEqual({
      jobId: "job-1",
    });
    await expect(authedCaller.connectors.connect({ id: "connector-1" })).resolves.toEqual({
      id: "connector-1",
    });
    await expect(caller.conversations.clearAll()).resolves.toEqual({ cleared: true });
    await expect(caller.pipelineAssets.getUsageCount({ id: "asset-1" })).resolves.toEqual({
      assetId: "asset-1",
      count: 1,
    });
    await expect(
      caller.usage.getDailyTokenSeries({
        from: new Date("2026-07-01T00:00:00.000Z"),
        to: new Date("2026-07-31T00:00:00.000Z"),
      }),
    ).resolves.toEqual([]);
  });

  it("requires a session for connector mutations", async () => {
    const caller = domainRouter.createCaller({ session: null });

    await expect(caller.connectors.connect({ id: "connector-1" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(mocks.connectorsConnect).not.toHaveBeenCalled();
  });

  it("requires a session to cancel pipeline runs", async () => {
    const caller = domainRouter.createCaller({ session: null });
    const authedCaller = domainRouter.createCaller({ session: { user: { id: "user-1" } } });

    await expect(caller.pipelines.cancel({ jobId: "job-1" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(authedCaller.pipelines.cancel({ jobId: "job-1" })).resolves.toEqual({
      cancelled: true,
      jobId: "job-1",
    });
  });

  it("filters pipeline routines by enabled status", async () => {
    mocks.routinesGetByPipelineId.mockResolvedValue([
      { id: "enabled", enabled: true },
      { id: "disabled", enabled: false },
    ]);
    const caller = domainRouter.createCaller({ session: null });

    await expect(caller.routines.getMany({ pipelineId: "p1", enabled: true })).resolves.toEqual([
      { id: "enabled", enabled: true },
    ]);
  });

  it("maps missing routine runs to NOT_FOUND", async () => {
    const notFound = new Error("Routine:missing not found");
    notFound.name = "NotFoundError";
    mocks.routinesRunNow.mockResolvedValue(err(notFound));
    const caller = domainRouter.createCaller({ session: null });

    await expect(caller.routines.runNow({ id: "missing" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("rejects conversation limit without a pipelineId", async () => {
    const caller = domainRouter.createCaller({ session: null });

    await expect(caller.conversations.getMany({ limit: 1 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(mocks.conversationsGetAll).not.toHaveBeenCalled();
  });
});

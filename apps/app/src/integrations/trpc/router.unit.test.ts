import { beforeEach, describe, expect, it, vi } from "vitest";
import { err, ok } from "neverthrow";

vi.hoisted(() => {
  process.env.BETTER_AUTH_SECRET = "test-secret";
  process.env.PGLITE_DATA_DIR = "/tmp/ordine-cod-122-test";
});

const mocks = vi.hoisted(() => ({
  connectorsConnect: vi.fn(),
  connectorsGetAll: vi.fn(),
  agentsGetAll: vi.fn(),
  operationsCreate: vi.fn(),
  projectsCreate: vi.fn(),
  pipelinesGetById: vi.fn(),
  pipelineStartRun: vi.fn(),
  conversationsClearAll: vi.fn(),
  conversationsGetAll: vi.fn(),
  pipelineAssetsGetAll: vi.fn(),
  pipelineAssetsGetUsageCount: vi.fn(),
  jobCancelRun: vi.fn(),
  jobPauseRun: vi.fn(),
  jobResumeRun: vi.fn(),
  projectsGetAll: vi.fn(),
  routinesGetByPipelineId: vi.fn(),
  routinesGetAll: vi.fn(),
  routinesRunNow: vi.fn(),
  usageGetDailyTokenSeries: vi.fn(),
}));

vi.mock("./services", () => ({
  agentRuntimesService: {},
  agentsService: { getAll: mocks.agentsGetAll },
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
  operationsService: { create: mocks.operationsCreate },
  pipelineAssetsService: {
    getAll: mocks.pipelineAssetsGetAll,
    getUsageCount: mocks.pipelineAssetsGetUsageCount,
  },
  pipelineRunnerService: {
    cancelRun: mocks.jobCancelRun,
    pauseRun: mocks.jobPauseRun,
    resumeRun: mocks.jobResumeRun,
    startRun: mocks.pipelineStartRun,
  },
  pipelinesService: { getById: mocks.pipelinesGetById },
  projectsService: { getAll: mocks.projectsGetAll, create: mocks.projectsCreate },
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
import { agentsRouter } from "./routers/agents";
import { connectorsRouter } from "./routers/connectors";
import { conversationsRouter } from "./routers/conversations";
import { operationsRouter } from "./routers/operations";
import { pipelineAssetsRouter } from "./routers/pipelineAssets";
import { jobsRouter } from "./routers/jobs";
import { pipelinesRouter } from "./routers/pipelines";
import { projectsRouter } from "./routers/projects";
import { routinesRouter } from "./routers/routines";
import { usageRouter } from "./routers/usage";

const domainRouter = router({
  agents: agentsRouter,
  connectors: connectorsRouter,
  conversations: conversationsRouter,
  pipelineAssets: pipelineAssetsRouter,
  jobs: jobsRouter,
  operations: operationsRouter,
  pipelines: pipelinesRouter,
  projects: projectsRouter,
  routines: routinesRouter,
  usage: usageRouter,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.connectorsConnect.mockResolvedValue(ok({ id: "connector-1" }));
  mocks.connectorsGetAll.mockResolvedValue(ok([]));
  mocks.agentsGetAll.mockResolvedValue([]);
  mocks.operationsCreate.mockResolvedValue(ok({ id: "op-1" }));
  mocks.projectsCreate.mockResolvedValue(ok({ id: "project-1", name: "Inbox" }));
  mocks.pipelinesGetById.mockResolvedValue(null);
  mocks.conversationsClearAll.mockResolvedValue(ok(undefined));
  mocks.conversationsGetAll.mockResolvedValue(ok([]));
  mocks.pipelineAssetsGetAll.mockResolvedValue(ok([]));
  mocks.pipelineAssetsGetUsageCount.mockResolvedValue(ok({ assetId: "asset-1", count: 1 }));
  mocks.jobCancelRun.mockResolvedValue(ok({ cancelled: true, jobId: "job-1" }));
  mocks.jobPauseRun.mockResolvedValue(ok({ jobId: "job-1", paused: true }));
  mocks.jobResumeRun.mockResolvedValue(ok({ jobId: "job-1", resumed: true }));
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

  it("keeps agent reads behind the authenticated procedure", async () => {
    const caller = domainRouter.createCaller({ session: null });
    const authedCaller = domainRouter.createCaller({ session: { user: { id: "user-1" } } });

    await expect(caller.agents.getMany()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(authedCaller.agents.getMany()).resolves.toEqual([]);
    expect(mocks.agentsGetAll).toHaveBeenCalledOnce();
  });

  it("applies operation route defaults before calling the service", async () => {
    const caller = domainRouter.createCaller({ session: null });

    await expect(caller.operations.create({ id: "op-1", name: "Read file" })).resolves.toEqual({
      id: "op-1",
    });
    expect(mocks.operationsCreate).toHaveBeenCalledWith({
      id: "op-1",
      name: "Read file",
      description: null,
      acceptedObjectTypes: ["file", "folder", "github-project"],
    });
  });

  it("maps operation service not-found errors to a tRPC error", async () => {
    const notFound = new Error("Operation:missing not found");
    notFound.name = "NotFoundError";
    mocks.operationsCreate.mockResolvedValue(err(notFound));
    const caller = domainRouter.createCaller({ session: null });

    await expect(
      caller.operations.create({ id: "missing", name: "Missing" }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("generates a project id at the route boundary", async () => {
    mocks.projectsCreate.mockImplementation(async (input) => ok(input));
    const caller = domainRouter.createCaller({ session: null });

    const project = await caller.projects.create({ name: "Inbox" });

    expect(project).toMatchObject({ name: "Inbox", description: "" });
    expect(project.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(mocks.projectsCreate).toHaveBeenCalledWith(project);
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

  it("does not start a pipeline run when the pipeline is missing", async () => {
    const caller = domainRouter.createCaller({ session: null });

    await expect(caller.pipelines.run({ id: "missing-pipeline" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(mocks.pipelineStartRun).not.toHaveBeenCalled();
  });

  it("exposes authenticated job controls for checkpoint handling", async () => {
    const caller = domainRouter.createCaller({ session: null });
    const authedCaller = domainRouter.createCaller({ session: { user: { id: "user-1" } } });

    await expect(caller.jobs.resume({ jobId: "job-1" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(authedCaller.jobs.pause({ jobId: "job-1" })).resolves.toEqual({
      jobId: "job-1",
      paused: true,
    });
    await expect(authedCaller.jobs.resume({ jobId: "job-1" })).resolves.toEqual({
      jobId: "job-1",
      resumed: true,
    });
    await expect(authedCaller.jobs.cancel({ jobId: "job-1" })).resolves.toEqual({
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

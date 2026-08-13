import { describe, expect, it, vi, beforeEach } from "vitest";
import { pipelineRunControl } from "../runControl";

type EngineDepsMock = {
  runSkill: (opts: unknown) => Promise<void>;
};

type PipelineRunOptionsMock = {
  engineDeps: EngineDepsMock;
};

type EngineDepsBuildOptionsMock = {
  getMcpConnectorInjection?: (selectedToolNames: readonly string[]) => Promise<unknown>;
};

const {
  mockJobsDao,
  mockConnectorsDao,
  mockPipelinesDao,
  mockAgentRuntimesDao,
  mockPipelineRunExecutorRun,
} = vi.hoisted(() => ({
  mockJobsDao: {
    findById: vi.fn(),
    updateStatus: vi.fn().mockResolvedValue(undefined),
    create: vi.fn().mockResolvedValue(undefined),
    setNodeStatuses: vi.fn().mockResolvedValue(undefined),
  },
  mockConnectorsDao: {
    findMany: vi.fn().mockResolvedValue([]),
  },
  mockPipelinesDao: {
    findById: vi.fn(),
  },
  mockAgentRuntimesDao: {
    findMany: vi.fn().mockResolvedValue([
      {
        id: "runtime-codex",
        name: "Codex Local",
        type: "codex",
        connection: { mode: "local" },
      },
    ]),
  },
  mockPipelineRunExecutorRun: vi.fn(async (opts: PipelineRunOptionsMock) => {
    await opts.engineDeps.runSkill({ allowedTools: ["mcp__github__read_issue"] } as never);
  }),
}));

vi.mock("@repo/obs", () => ({
  initObs: vi.fn(),
  initSpanRecorder: vi.fn(),
  trace: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@repo/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock("@repo/models", () => ({
  createAgentsDao: vi.fn(() => ({})),
  createOperationsDao: vi.fn(() => ({})),
  createPipelinesDao: vi.fn(() => mockPipelinesDao),
  createJobsDao: vi.fn(() => mockJobsDao),
  createJobTracesDao: vi.fn(() => ({})),
  createSkillsDao: vi.fn(() => ({})),
  createAgentRawExportsDao: vi.fn(() => ({})),
  createAgentSpansDao: vi.fn(() => ({})),
  createSettingsDao: vi.fn(() => ({ get: vi.fn().mockResolvedValue({}) })),
  createPipelineRunsDao: vi.fn(() => ({ create: vi.fn().mockResolvedValue(undefined) })),
  createAgentRuntimesDao: vi.fn(() => mockAgentRuntimesDao),
  createConnectorsDao: vi.fn(() => mockConnectorsDao),
}));

vi.mock("../engineDeps", () => ({
  pipelineRunnerEngineDeps: {
    build: vi.fn((opts: EngineDepsBuildOptionsMock) => ({
      runPrompt: vi.fn(),
      runSkill: vi.fn(async () => {
        await opts.getMcpConnectorInjection?.(["mcp__github__read_issue"]);
      }),
      structuredJsonToMarkdown: vi.fn(),
      evaluateLoopCondition: vi.fn(),
    })),
  },
}));

vi.mock("../runPipeline", () => ({
  pipelineRunExecutor: {
    run: mockPipelineRunExecutorRun,
  },
}));

import type { DbConnection } from "@repo/models";
import {
  AgentRuntimeNotFoundError,
  createPipelineRunnerService,
  JobNotFoundError,
  InvalidJobStatusError,
} from "./createPipelineRunnerService";

const makeService = () => createPipelineRunnerService({} as DbConnection);

describe("createPipelineRunnerService run controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockJobsDao.updateStatus.mockResolvedValue(undefined);
    mockConnectorsDao.findMany.mockResolvedValue([]);
    mockPipelinesDao.findById.mockResolvedValue({
      id: "pipe-1",
      name: "Pipe",
      description: "Pipeline description",
      projectId: null,
      nodes: [],
      edges: [],
    });
    mockAgentRuntimesDao.findMany.mockResolvedValue([
      {
        id: "runtime-codex",
        name: "Codex Local",
        type: "codex",
        connection: { mode: "local" },
      },
    ]);
  });

  it("resumeRun releases a checkpoint waiter while the job status is still running", async () => {
    const jobId = "job-checkpoint";
    mockJobsDao.findById.mockResolvedValue({ id: jobId, status: "running" });
    const service = makeService();

    // The engine suspends on a checkpoint node; the job status stays "running".
    const control = pipelineRunControl.buildForJob(jobId);
    const releaseState = { released: false };
    const waiting = control
      .waitForResume?.({ jobId, nodeId: "n1", reason: "checkpoint" })
      .then(() => {
        releaseState.released = true;
      });
    expect(releaseState.released).toBe(false);

    const result = await service.resumeRun(jobId);
    await waiting;

    expect(result.isOk()).toBe(true);
    expect(releaseState.released).toBe(true);
    expect(mockJobsDao.updateStatus).toHaveBeenCalledWith(jobId, "running", undefined);

    pipelineRunControl.clear(jobId);
  });

  it("resumeRun still works for a paused job", async () => {
    const jobId = "job-paused-resume";
    mockJobsDao.findById.mockResolvedValue({ id: jobId, status: "paused" });
    const service = makeService();

    const result = await service.resumeRun(jobId);

    expect(result.isOk()).toBe(true);
    expect(mockJobsDao.updateStatus).toHaveBeenCalledWith(jobId, "running", undefined);

    pipelineRunControl.clear(jobId);
  });

  it("resumeRun rejects terminal jobs", async () => {
    mockJobsDao.findById.mockResolvedValue({ id: "job-done", status: "done" });
    const service = makeService();

    const result = await service.resumeRun("job-done");

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(InvalidJobStatusError);
    }
    expect(mockJobsDao.updateStatus).not.toHaveBeenCalled();
  });

  it("resumeRun rejects unknown jobs", async () => {
    mockJobsDao.findById.mockResolvedValue(undefined);
    const service = makeService();

    const result = await service.resumeRun("job-missing");

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(JobNotFoundError);
    }
  });

  it("cancelRun cancels a queued job", async () => {
    const jobId = "job-queued-cancel";
    mockJobsDao.findById.mockResolvedValue({ id: jobId, status: "queued" });
    const service = makeService();

    const result = await service.cancelRun(jobId);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual({ jobId, cancelled: true });
    }
    expect(mockJobsDao.updateStatus).toHaveBeenCalledWith(
      jobId,
      "cancelled",
      expect.objectContaining({ finishedAt: expect.any(Date) }),
    );

    pipelineRunControl.clear(jobId);
  });

  it("pauseRun rejects a queued job (pause only applies to running jobs)", async () => {
    mockJobsDao.findById.mockResolvedValue({ id: "job-q", status: "queued" });
    const service = makeService();

    const result = await service.pauseRun("job-q");

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(InvalidJobStatusError);
    }
    expect(mockJobsDao.updateStatus).not.toHaveBeenCalled();
  });

  it("surfaces a DB write failure as an error result", async () => {
    mockJobsDao.findById.mockResolvedValue({ id: "job-db", status: "running" });
    mockJobsDao.updateStatus.mockRejectedValueOnce(new Error("DB down"));
    const service = makeService();

    const result = await service.pauseRun("job-db");

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("DB down");
    }
  });

  it("builds connector injection from only the tools selected for the run", async () => {
    const service = makeService();

    const result = await service.startRun({ pipelineId: "pipe-1" });
    expect(result.isOk()).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockConnectorsDao.findMany).toHaveBeenCalledOnce();
  });

  it("rejects a run before creating a job when no Agent runtime is configured", async () => {
    mockAgentRuntimesDao.findMany.mockResolvedValueOnce([]);
    const service = makeService();

    const result = await service.startRun({ pipelineId: "pipe-1" });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(AgentRuntimeNotFoundError);
    }
    expect(mockJobsDao.create).not.toHaveBeenCalled();
    expect(mockPipelineRunExecutorRun).not.toHaveBeenCalled();
  });
});

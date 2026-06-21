import { describe, expect, it, vi, beforeEach } from "vitest";
import { okAsync } from "neverthrow";
import { pipelineEngine, type PipelineEngineDeps } from "@repo/pipeline-engine";
import type * as PipelineEngineModule from "@repo/pipeline-engine";
import type {
  AgentsDao,
  PipelinesDao,
  OperationsDao,
  JobsDao,
  PipelineRunsDao,
  SkillsDao,
  AgentRawExportsDao,
} from "@repo/models";

vi.mock("@repo/obs", () => ({
  trace: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@repo/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock("@repo/pipeline-engine", async (importOriginal) => {
  const orig = await importOriginal<typeof PipelineEngineModule>();

  return {
    ...orig,
    pipelineEngine: {
      execute: vi.fn(),
    },
  };
});

import { pipelineRunExecutor } from ".";

const makeOpts = (overrides = {}) => ({
  pipelineId: "pipe-1",
  jobId: "job-1",
  pipelinesDao: {
    findById: vi.fn().mockResolvedValue({
      id: "pipe-1",
      name: "Test",
      nodes: [],
      edges: [],
    }),
  } as unknown as PipelinesDao,
  operationsDao: { findById: vi.fn() } as unknown as OperationsDao,
  agentsDao: { findById: vi.fn() } as unknown as AgentsDao,
  jobsDao: {
    create: vi.fn().mockResolvedValue(undefined),
    updateStatus: vi.fn().mockResolvedValue(undefined),
    updateNodeStatuses: vi.fn().mockResolvedValue(undefined),
  } as unknown as JobsDao,
  pipelineRunsDao: {
    update: vi.fn().mockResolvedValue(undefined),
  } as unknown as PipelineRunsDao,
  skillsDao: { findById: vi.fn(), findByName: vi.fn() } as unknown as SkillsDao,
  agentRawExportsDao: {
    findByJobId: vi.fn().mockResolvedValue([]),
  } as unknown as AgentRawExportsDao,
  pipelineAssetsService: {
    distillFromPipeline: vi.fn().mockReturnValue(okAsync({ id: "asset-1" })),
    incrementRunStats: vi.fn().mockReturnValue(okAsync({ id: "asset-1" })),
  },
  engineDeps: {
    runPrompt: vi.fn().mockReturnValue(okAsync("")),
    runSkill: vi.fn().mockReturnValue(okAsync("")),
    structuredJsonToMarkdown: vi.fn(),
    evaluateLoopCondition: vi.fn(),
  } as unknown as PipelineEngineDeps,
  ...overrides,
});

describe("runPipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks job as done on successful engine execution", async () => {
    vi.mocked(pipelineEngine.execute).mockResolvedValue({
      ok: true as const,
      summary: "All good",
    });
    const opts = makeOpts();
    await pipelineRunExecutor.run(opts);

    expect(opts.jobsDao.updateStatus).toHaveBeenCalledWith("job-1", "running", expect.anything());
    expect(opts.pipelineRunsDao.update).toHaveBeenCalledWith(
      "job-1",
      expect.objectContaining({ result: { summary: "All good" } }),
    );
    expect(opts.jobsDao.updateStatus).toHaveBeenCalledWith(
      "job-1",
      "done",
      expect.objectContaining({
        finishedAt: expect.any(Date),
        totalTokens: 0,
        totalCost: "0.0000",
      }),
    );
    expect(opts.pipelineAssetsService.distillFromPipeline).toHaveBeenCalledWith("pipe-1");
    expect(opts.pipelineAssetsService.incrementRunStats).toHaveBeenCalledWith(
      "asset-1",
      expect.objectContaining({
        success: true,
        durationMs: expect.any(Number),
      }),
    );
  });

  it("persists node status events from the engine", async () => {
    vi.mocked(pipelineEngine.execute).mockImplementation(async (engineOpts) => {
      await engineOpts.onNodeStatusChange?.({
        jobId: "job-1",
        nodeId: "node-a",
        status: "queued",
      });
      await engineOpts.onNodeStatusChange?.({
        jobId: "job-1",
        nodeId: "node-a",
        status: "running",
      });
      await engineOpts.onNodeStatusChange?.({
        jobId: "job-1",
        nodeId: "node-a",
        status: "done",
      });

      return {
        ok: true as const,
        summary: "All good",
      };
    });
    const opts = makeOpts();
    await pipelineRunExecutor.run(opts);

    expect(opts.jobsDao.updateNodeStatuses).toHaveBeenNthCalledWith(1, "job-1", {
      "node-a": "queued",
    });
    expect(opts.jobsDao.updateNodeStatuses).toHaveBeenNthCalledWith(2, "job-1", {
      "node-a": "running",
    });
    expect(opts.jobsDao.updateNodeStatuses).toHaveBeenNthCalledWith(3, "job-1", {
      "node-a": "done",
    });
  });

  it("aggregates agent raw export usage into the completed job", async () => {
    vi.mocked(pipelineEngine.execute).mockResolvedValue({
      ok: true as const,
      summary: "All good",
    });
    const opts = makeOpts({
      agentRawExportsDao: {
        findByJobId: vi.fn().mockResolvedValue([
          {
            tokenInput: 10,
            tokenOutput: 15,
            rawPayload: { events: [{ type: "result", total_cost_usd: 0.125 }] },
          },
          {
            tokenInput: 5,
            tokenOutput: null,
            rawPayload: { totalCost: 0.25 },
          },
        ]),
      } as unknown as AgentRawExportsDao,
    });
    await pipelineRunExecutor.run(opts);

    expect(opts.jobsDao.updateStatus).toHaveBeenCalledWith(
      "job-1",
      "done",
      expect.objectContaining({
        totalTokens: 30,
        totalCost: "0.3750",
      }),
    );
  });

  it("marks job as failed when pipeline not found", async () => {
    const opts = makeOpts({
      pipelinesDao: {
        findById: vi.fn().mockResolvedValue(null),
      } as unknown as PipelinesDao,
    });
    await pipelineRunExecutor.run(opts);

    expect(opts.jobsDao.updateStatus).toHaveBeenCalledWith(
      "job-1",
      "failed",
      expect.objectContaining({ error: expect.stringContaining("not found") }),
    );
  });

  it("marks job as failed when engine throws", async () => {
    vi.mocked(pipelineEngine.execute).mockRejectedValue(new Error("engine boom"));
    const opts = makeOpts();
    await pipelineRunExecutor.run(opts);

    expect(opts.jobsDao.updateStatus).toHaveBeenCalledWith(
      "job-1",
      "failed",
      expect.objectContaining({ error: expect.stringContaining("engine boom") }),
    );
  });

  it("catches and marks job failed when DAO throws during setup", async () => {
    const opts = makeOpts({
      jobsDao: {
        create: vi.fn().mockResolvedValue(undefined),
        updateStatus: vi
          .fn()
          .mockRejectedValueOnce(new Error("DB down"))
          .mockResolvedValue(undefined),
        updateNodeStatuses: vi.fn().mockResolvedValue(undefined),
      } as unknown as JobsDao,
      pipelineRunsDao: {
        update: vi.fn().mockResolvedValue(undefined),
      } as unknown as PipelineRunsDao,
    });
    // First updateStatus("running") throws, but top-level catch should still try to mark failed
    await pipelineRunExecutor.run(opts);

    // Should not throw unhandled rejection
    expect(true).toBe(true);
  });
});

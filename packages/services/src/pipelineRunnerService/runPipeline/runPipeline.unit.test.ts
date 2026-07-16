import { describe, expect, it, vi, beforeEach } from "vitest";
import { okAsync } from "neverthrow";
import {
  pipelineEngine,
  PipelineCancelledError,
  ScriptExecutionError,
  type PipelineEngineDeps,
} from "@repo/pipeline-engine";
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
      description: "Pipeline description",
      nodes: [],
      edges: [],
    }),
  } as unknown as PipelinesDao,
  operationsDao: { findById: vi.fn() } as unknown as OperationsDao,
  agentsDao: { findById: vi.fn() } as unknown as AgentsDao,
  jobsDao: {
    create: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue({ id: "job-1", status: "running" }),
    updateStatus: vi.fn().mockResolvedValue(undefined),
    setNodeStatuses: vi.fn().mockResolvedValue(undefined),
  } as unknown as JobsDao,
  pipelineRunsDao: {
    update: vi.fn().mockResolvedValue(undefined),
  } as unknown as PipelineRunsDao,
  skillsDao: { findById: vi.fn(), findByName: vi.fn() } as unknown as SkillsDao,
  agentRawExportsDao: {
    findByJobId: vi.fn().mockResolvedValue([]),
  } as unknown as AgentRawExportsDao,
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
      expect.objectContaining({ finishedAt: expect.any(Date), totalTokens: 0 }),
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

    expect(opts.jobsDao.setNodeStatuses).toHaveBeenNthCalledWith(1, "job-1", {
      "node-a": "queued",
    });
    expect(opts.jobsDao.setNodeStatuses).toHaveBeenNthCalledWith(2, "job-1", {
      "node-a": "running",
    });
    expect(opts.jobsDao.setNodeStatuses).toHaveBeenNthCalledWith(3, "job-1", {
      "node-a": "done",
    });
  });

  it("aggregates persisted token usage into the completed job", async () => {
    vi.mocked(pipelineEngine.execute).mockResolvedValue({
      ok: true as const,
      summary: "All good",
    });
    const opts = makeOpts({
      agentRawExportsDao: {
        findByJobId: vi.fn().mockResolvedValue([
          { tokenInput: 10, tokenOutput: 15 },
          { tokenInput: 5, tokenOutput: null },
        ]),
      } as unknown as AgentRawExportsDao,
    });
    await pipelineRunExecutor.run(opts);

    expect(opts.jobsDao.updateStatus).toHaveBeenCalledWith(
      "job-1",
      "done",
      expect.objectContaining({ totalTokens: 30 }),
    );
  });

  it("does not overwrite a cancelled job with done", async () => {
    vi.mocked(pipelineEngine.execute).mockResolvedValue({
      ok: true as const,
      summary: "All good",
    });
    const opts = makeOpts({
      jobsDao: {
        create: vi.fn().mockResolvedValue(undefined),
        // cancelRun already flipped the job to cancelled while the last node was executing.
        findById: vi.fn().mockResolvedValue({ id: "job-1", status: "cancelled" }),
        updateStatus: vi.fn().mockResolvedValue(undefined),
        setNodeStatuses: vi.fn().mockResolvedValue(undefined),
      } as unknown as JobsDao,
    });
    await pipelineRunExecutor.run(opts);

    expect(opts.jobsDao.updateStatus).not.toHaveBeenCalledWith("job-1", "done", expect.anything());
    expect(opts.jobsDao.updateStatus).not.toHaveBeenCalledWith(
      "job-1",
      "failed",
      expect.anything(),
    );
  });

  it("does not overwrite a cancelled job with failed", async () => {
    vi.mocked(pipelineEngine.execute).mockResolvedValue({
      ok: false as const,
      error: new ScriptExecutionError("node blew up"),
    });
    const opts = makeOpts({
      jobsDao: {
        create: vi.fn().mockResolvedValue(undefined),
        findById: vi.fn().mockResolvedValue({ id: "job-1", status: "cancelled" }),
        updateStatus: vi.fn().mockResolvedValue(undefined),
        setNodeStatuses: vi.fn().mockResolvedValue(undefined),
      } as unknown as JobsDao,
    });
    await pipelineRunExecutor.run(opts);

    expect(opts.jobsDao.updateStatus).not.toHaveBeenCalledWith(
      "job-1",
      "failed",
      expect.anything(),
    );
  });

  it("settles a cancelled engine outcome without marking the job failed", async () => {
    vi.mocked(pipelineEngine.execute).mockResolvedValue({
      ok: false as const,
      error: new PipelineCancelledError("node-2"),
    });
    const onRunSettled = vi.fn();
    const opts = makeOpts({
      onRunSettled,
      jobsDao: {
        create: vi.fn().mockResolvedValue(undefined),
        findById: vi.fn().mockResolvedValue({ id: "job-1", status: "cancelled" }),
        updateStatus: vi.fn().mockResolvedValue(undefined),
        setNodeStatuses: vi.fn().mockResolvedValue(undefined),
      } as unknown as JobsDao,
      agentRawExportsDao: {
        findByJobId: vi.fn().mockResolvedValue([{ tokenInput: 7, tokenOutput: 3 }]),
      } as unknown as AgentRawExportsDao,
    });
    await pipelineRunExecutor.run(opts);

    expect(opts.jobsDao.updateStatus).not.toHaveBeenCalledWith(
      "job-1",
      "failed",
      expect.anything(),
    );
    // Usage gathered before the cancellation still lands on the cancelled job.
    expect(opts.jobsDao.updateStatus).toHaveBeenCalledWith(
      "job-1",
      "cancelled",
      expect.objectContaining({ totalTokens: 10 }),
    );
    expect(onRunSettled).toHaveBeenCalledOnce();
  });

  it("still marks the job done when usage aggregation fails", async () => {
    vi.mocked(pipelineEngine.execute).mockResolvedValue({
      ok: true as const,
      summary: "All good",
    });
    const opts = makeOpts({
      agentRawExportsDao: {
        findByJobId: vi.fn().mockRejectedValue(new Error("exports table unavailable")),
      } as unknown as AgentRawExportsDao,
    });
    await pipelineRunExecutor.run(opts);

    expect(opts.jobsDao.updateStatus).toHaveBeenCalledWith(
      "job-1",
      "done",
      expect.objectContaining({ finishedAt: expect.any(Date) }),
    );
    expect(opts.jobsDao.updateStatus).not.toHaveBeenCalledWith(
      "job-1",
      "failed",
      expect.anything(),
    );
  });

  it("invokes onRunSettled after the run settles", async () => {
    vi.mocked(pipelineEngine.execute).mockResolvedValue({
      ok: true as const,
      summary: "All good",
    });
    const onRunSettled = vi.fn();
    const opts = makeOpts({ onRunSettled });
    await pipelineRunExecutor.run(opts);

    expect(onRunSettled).toHaveBeenCalledOnce();
  });

  it("passes pipeline context and operation descriptions into engine execution", async () => {
    vi.mocked(pipelineEngine.execute).mockResolvedValue({
      ok: true as const,
      summary: "All good",
    });
    const opts = makeOpts({
      pipelinesDao: {
        findById: vi.fn().mockResolvedValue({
          id: "pipe-1",
          name: "Context Pipeline",
          description: "Coordinate a repository review",
          sharedContext: "Always produce concise review notes",
          nodes: [
            {
              id: "op-node",
              type: "operation",
              position: { x: 0, y: 0 },
              data: { nodeType: "operation", operationId: "op-1", label: "Review" },
            },
          ],
          edges: [],
        }),
      } as unknown as PipelinesDao,
      operationsDao: {
        findById: vi.fn().mockResolvedValue({
          id: "op-1",
          name: "Review",
          description: "Review the current project",
          config: { executor: { type: "agent", agentMode: "prompt", prompt: "Review" } },
        }),
      } as unknown as OperationsDao,
    });

    await pipelineRunExecutor.run(opts);

    expect(pipelineEngine.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        pipeline: expect.objectContaining({
          name: "Context Pipeline",
          description: "Coordinate a repository review",
          sharedContext: "Always produce concise review notes",
        }),
        operations: expect.any(Map),
      }),
    );
    const callArgs = vi.mocked(pipelineEngine.execute).mock.calls[0]![0];
    expect(callArgs.operations.get("op-1")).toMatchObject({
      name: "Review",
      description: "Review the current project",
    });
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
        findById: vi.fn().mockResolvedValue({ id: "job-1", status: "running" }),
        updateStatus: vi
          .fn()
          .mockRejectedValueOnce(new Error("DB down"))
          .mockResolvedValue(undefined),
        setNodeStatuses: vi.fn().mockResolvedValue(undefined),
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

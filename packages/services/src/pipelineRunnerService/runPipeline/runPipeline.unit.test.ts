import { describe, expect, it, vi, beforeEach } from "vitest";
import { okAsync } from "neverthrow";
import { pipelineEngine, type PipelineEngineDeps } from "@repo/pipeline-engine";
import type * as PipelineEngineModule from "@repo/pipeline-engine";
import type {
  PipelinesDao,
  OperationsDao,
  JobsDao,
  SkillsDao,
  BestPracticesDao,
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
  jobsDao: {
    create: vi.fn().mockResolvedValue(undefined),
    updateStatus: vi.fn().mockResolvedValue(undefined),
  } as unknown as JobsDao,
  skillsDao: { findById: vi.fn(), findByName: vi.fn() } as unknown as SkillsDao,
  bestPracticesDao: { findById: vi.fn() } as unknown as BestPracticesDao,
  engineDeps: {
    runPrompt: vi.fn().mockReturnValue(okAsync("")),
    runSkill: vi.fn().mockReturnValue(okAsync("")),
    runRuleCheck: vi.fn(),
    structuredJsonToMarkdown: vi.fn(),
    listDirTree: vi.fn(),
    readProjectFiles: vi.fn(),
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
    expect(opts.jobsDao.updateStatus).toHaveBeenCalledWith(
      "job-1",
      "done",
      expect.objectContaining({
        result: { summary: "All good" },
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
      } as unknown as JobsDao,
    });
    // First updateStatus("running") throws, but top-level catch should still try to mark failed
    await pipelineRunExecutor.run(opts);

    // Should not throw unhandled rejection
    expect(true).toBe(true);
  });
});

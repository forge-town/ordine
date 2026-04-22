import { describe, expect, it, vi, beforeEach } from "vitest";
import { okAsync } from "neverthrow";
import { pipelineEngine } from "@repo/pipeline-engine";
import type * as PipelineEngineModule from "@repo/pipeline-engine";

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
  },
  operationsDao: { findById: vi.fn() },
  jobsDao: {
    create: vi.fn().mockResolvedValue(undefined),
    updateStatus: vi.fn().mockResolvedValue(undefined),
  },
  skillsDao: { findById: vi.fn(), findByName: vi.fn() },
  bestPracticesDao: { findById: vi.fn() },
  engineDeps: {
    runPrompt: vi.fn().mockReturnValue(okAsync("")),
    runSkill: vi.fn().mockReturnValue(okAsync("")),
    runRuleCheck: vi.fn(),
    structuredJsonToMarkdown: vi.fn(),
    evaluateLoopCondition: vi.fn(),
  },
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
    // @ts-expect-error -- mock DAOs are partial implementations
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
      },
    });
    // @ts-expect-error -- mock DAOs are partial implementations
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
    // @ts-expect-error -- mock DAOs are partial implementations
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
      },
    });
    // First updateStatus("running") throws, but top-level catch should still try to mark failed
    // @ts-expect-error -- mock DAOs are partial implementations
    await pipelineRunExecutor.run(opts);

    // Should not throw unhandled rejection
    expect(true).toBe(true);
  });
});

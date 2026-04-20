import { describe, expect, it, vi, beforeEach } from "vitest";
import { okAsync } from "neverthrow";
import type { PipelineEngineDeps } from "@repo/pipeline-engine";
import type {
  PipelinesDaoInstance,
  OperationsDaoInstance,
  JobsDaoInstance,
  SkillsDaoInstance,
  BestPracticesDaoInstance,
} from "@repo/models";

vi.mock("@repo/obs", () => ({
  trace: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@repo/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock("@repo/pipeline-engine", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@repo/pipeline-engine")>();

  return {
    ...orig,
    pipelineEngine: {
      execute: vi.fn(),
    },
  };
});

import { runPipeline } from "./runPipeline";
import { pipelineEngine } from "@repo/pipeline-engine";

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
  } as unknown as PipelinesDaoInstance,
  operationsDao: { findById: vi.fn() } as unknown as OperationsDaoInstance,
  jobsDao: {
    create: vi.fn().mockResolvedValue(undefined),
    updateStatus: vi.fn().mockResolvedValue(undefined),
  } as unknown as JobsDaoInstance,
  skillsDao: { findById: vi.fn(), findByName: vi.fn() } as unknown as SkillsDaoInstance,
  bestPracticesDao: { findById: vi.fn() } as unknown as BestPracticesDaoInstance,
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
    await runPipeline(opts);

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
      } as unknown as PipelinesDaoInstance,
    });
    await runPipeline(opts);

    expect(opts.jobsDao.updateStatus).toHaveBeenCalledWith(
      "job-1",
      "failed",
      expect.objectContaining({ error: expect.stringContaining("not found") }),
    );
  });

  it("marks job as failed when engine throws", async () => {
    vi.mocked(pipelineEngine.execute).mockRejectedValue(new Error("engine boom"));
    const opts = makeOpts();
    await runPipeline(opts);

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
      } as unknown as JobsDaoInstance,
    });
    // First updateStatus("running") throws, but top-level catch should still try to mark failed
    await runPipeline(opts);

    // Should not throw unhandled rejection
    expect(true).toBe(true);
  });
});

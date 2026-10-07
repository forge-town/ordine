import { describe, expect, it, vi, beforeEach } from "vitest";

import { okAsync } from "neverthrow";

import {
  pipelineEngine,
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

import { pipelineRunExecutor } from "../runPipeline";

const makeJobsDao = (overrides = {}) =>
  ({
    create: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue({ id: "job-1", status: "running" }),
    updateStatus: vi.fn().mockResolvedValue(undefined),
    transitionStatus: vi.fn().mockResolvedValue({ id: "job-1" }),
    setNodeStatuses: vi.fn().mockResolvedValue(undefined),
    claimExecutionLease: vi.fn().mockResolvedValue({ id: "job-1", status: "running" }),
    renewExecutionLease: vi.fn().mockResolvedValue({ status: "running" }),
    recordErrorIfExpired: vi.fn().mockResolvedValue(undefined),
    updateUsageTotals: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }) as unknown as JobsDao;

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
  jobsDao: makeJobsDao(),
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

  it("preserves the provider error when expiry wins the terminal-status race", async () => {
    vi.mocked(pipelineEngine.execute).mockResolvedValue({
      ok: false as const,
      error: new ScriptExecutionError("MCP connection closed"),
    });
    const recordErrorIfExpired = vi.fn().mockResolvedValue({
      id: "job-1",
      status: "expired",
      error: "MCP connection closed",
    });
    const opts = makeOpts({
      jobsDao: makeJobsDao({
        transitionStatus: vi.fn().mockResolvedValue(undefined),
        recordErrorIfExpired,
      }),
    });

    await pipelineRunExecutor.run(opts);

    expect(recordErrorIfExpired).toHaveBeenCalledWith("job-1", "MCP connection closed");
  });
});

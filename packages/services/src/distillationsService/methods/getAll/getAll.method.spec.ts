import { describe, expect, it, vi, beforeEach } from "vitest";

const baseRecord = {
  id: "dst-1",
  title: "Distill job run",
  summary: "",
  sourceType: "job" as const,
  sourceId: "job-1",
  sourceLabel: "Run job-1",
  mode: "pipeline" as const,
  status: "draft" as const,
  config: {
    objective: "Find the minimal reproducible path",
  },
  inputSnapshot: null,
  result: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

const toMetaRecord = <T extends { createdAt: Date; updatedAt: Date }>(record: T) => {
  const { createdAt, updatedAt, ...rest } = record;

  return {
    ...rest,
    meta: { createdAt, updatedAt },
  };
};

const mockDistillationsDao = {
  findMany: vi.fn().mockResolvedValue([baseRecord]),
  findById: vi.fn().mockResolvedValue(baseRecord),
  create: vi.fn().mockResolvedValue(baseRecord),
  update: vi.fn().mockResolvedValue(baseRecord),
  delete: vi.fn().mockResolvedValue(undefined),
};

const mockJobsDao = {
  findById: vi.fn().mockResolvedValue({
    id: "job-1",
    title: "Pipeline Run",
    status: "completed",
    result: { ok: true },
  }),
};

const mockJobTracesDao = {
  findByJobId: vi
    .fn()
    .mockResolvedValue([{ level: "info", message: "Started", createdAt: new Date(0) }]),
};

const mockAgentRawExportsDao = {
  findByJobId: vi.fn().mockResolvedValue([
    {
      id: 1,
      agentRuntime: "mastra",
      agentId: "prompt-executor",
      modelId: "kimi-k2",
      tokenInput: 20,
      tokenOutput: 10,
      durationMs: 1000,
      status: "completed",
      createdAt: new Date(0),
      rawPayload: { system: "sys", prompt: "user", output: "done" },
    },
  ]),
};

const mockAgentSpansDao = {
  findByJobId: vi.fn().mockResolvedValue([
    {
      spanType: "agent_run",
      name: "prompt-executor",
      status: "completed",
      durationMs: 1000,
      modelId: "kimi-k2",
      startedAt: new Date(0),
      finishedAt: new Date(0),
    },
  ]),
};

const mockPipelinesDao = {
  findById: vi.fn().mockResolvedValue({ id: "pipe-1", name: "Pipeline" }),
};

const mockSettingsDao = {
  get: vi.fn().mockResolvedValue({
    defaultAgentRuntime: "mastra",
    defaultApiKey: "secret",
    defaultModel: "kimi-k2",
  }),
};

const mockRunAgent = vi.fn();

vi.mock("@repo/models", () => ({
  createDistillationsDao: () => mockDistillationsDao,
  createJobsDao: () => mockJobsDao,
  createJobTracesDao: () => mockJobTracesDao,
  createAgentRawExportsDao: () => mockAgentRawExportsDao,
  createAgentSpansDao: () => mockAgentSpansDao,
  createPipelinesDao: () => mockPipelinesDao,
  createSettingsDao: () => mockSettingsDao,
}));

vi.mock("../../../pipelineRunnerService/helpers/agentRunner/agentRunner.helper", () => ({
  runAgent: (...args: Parameters<typeof mockRunAgent>) => mockRunAgent(...args),
}));

import { createDistillationsService } from "../../distillations.service";
import type { DbConnection } from "@repo/models";

// @ts-expect-error -- DAO layer is mocked in tests
const mockDb: DbConnection = {};

describe("createDistillationsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDistillationsDao.findMany.mockResolvedValue([baseRecord]);
    mockDistillationsDao.findById.mockResolvedValue(baseRecord);
    mockDistillationsDao.create.mockResolvedValue(baseRecord);
    mockDistillationsDao.update.mockResolvedValue(baseRecord);
    mockRunAgent.mockResolvedValue(
      JSON.stringify({
        type: "completed",
        summary: "Critical path extracted",
        insights: ["The first two steps produce the decisive signal."],
        minimalPath: ["Load job traces", "Keep the first agent run", "Drop the rest"],
        reusableAssets: [
          {
            type: "pipeline_template",
            title: "Lean trace review",
            content: "1. Load traces. 2. Keep decisive run. 3. Export summary.",
          },
        ],
        nextActions: ["Turn the lean trace review into a template."],
      }),
    );
  });
  it("getAll delegates to dao.findMany", async () => {
    const svc = createDistillationsService(mockDb);
    const result = await svc.getAll();

    expect(mockDistillationsDao.findMany).toHaveBeenCalled();
    expect(result).toEqual([toMetaRecord(baseRecord)]);
  });
});

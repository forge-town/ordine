import { describe, expect, it, vi, beforeEach } from "vitest";

import { pipelineRunControl } from "../../helpers/runControl";

type EngineDepsMock = {
  runSkill: (opts: unknown) => Promise<void>;
};

type PipelineRunOptionsMock = {
  engineDeps: EngineDepsMock;
};

type EngineDepsBuildOptionsMock = {
  getMcpConnectorInjection?: (selectedToolNames: readonly string[]) => Promise<unknown>;
  defaultAgent?: string;
  model?: string;
  reasoningEffort?: string;
  speed?: string;
  runtimeConfigId?: string;
  executablePath?: string;
  overrideOperationRoute?: boolean;
};

const {
  mockJobsDao,
  mockConnectorsDao,
  mockOperationsDao,
  mockPipelinesDao,
  mockAgentRuntimesDao,
  mockMcpInjections,
  mockMcpServerKey,
  mockMcpToolReference,
  mockPipelineRunExecutorRun,
} = vi.hoisted(() => {
  const mockMcpServerKey = "connector_636f6e6e6563746f722d676974687562";
  const mockMcpToolReference = `mcp__${mockMcpServerKey}__read_issue`;

  return {
    mockMcpInjections: [] as unknown[],
    mockMcpServerKey,
    mockMcpToolReference,
    mockJobsDao: {
      findById: vi.fn(),
      updateStatus: vi.fn().mockResolvedValue(undefined),
      transitionStatus: vi.fn().mockResolvedValue({ id: "job-1" }),
      create: vi.fn().mockResolvedValue(undefined),
      setNodeStatuses: vi.fn().mockResolvedValue(undefined),
    },
    mockConnectorsDao: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    mockOperationsDao: {
      findById: vi.fn(),
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
      await opts.engineDeps.runSkill({ allowedTools: [mockMcpToolReference] } as never);
    }),
  };
});

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
  createOperationsDao: vi.fn(() => mockOperationsDao),
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

vi.mock("../../helpers/engineDeps", () => ({
  pipelineRunnerEngineDeps: {
    build: vi.fn((opts: EngineDepsBuildOptionsMock) => ({
      runPrompt: vi.fn(),
      runSkill: vi.fn(async () => {
        mockMcpInjections.push(await opts.getMcpConnectorInjection?.([mockMcpToolReference]));
      }),
      structuredJsonToMarkdown: vi.fn(),
      evaluateLoopCondition: vi.fn(),
    })),
  },
}));

vi.mock("../../helpers/runPipeline", () => ({
  pipelineRunExecutor: {
    run: mockPipelineRunExecutorRun,
  },
}));

import type { DbConnection } from "@repo/models";

import { createPipelineRunnerService } from "../..";

const makeService = () => createPipelineRunnerService({} as DbConnection);

describe("createPipelineRunnerService run controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockJobsDao.updateStatus.mockResolvedValue(undefined);
    mockJobsDao.transitionStatus.mockResolvedValue({ id: "job-1" });
    mockMcpInjections.length = 0;
    mockConnectorsDao.findMany.mockResolvedValue([]);
    mockOperationsDao.findById.mockReset();
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
        connection: { mode: "local", path: "C:\\Tools\\codex.cmd" },
      },
    ]);
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
    expect(mockJobsDao.transitionStatus).toHaveBeenCalledWith(
      jobId,
      ["queued", "running", "paused"],
      "cancelled",
      expect.objectContaining({ finishedAt: expect.any(Date) }),
    );

    pipelineRunControl.clear(jobId);
  });
});

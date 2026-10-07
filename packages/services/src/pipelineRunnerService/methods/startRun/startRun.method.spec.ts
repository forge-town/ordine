import { describe, expect, it, vi, beforeEach } from "vitest";

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

import { AgentRuntimeNotFoundError, createPipelineRunnerService } from "../..";

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

  it("rejects an unknown selected runtime before creating a job", async () => {
    const service = makeService();

    const result = await service.startRun({
      pipelineId: "pipe-1",
      runtimeConfigId: "missing-runtime",
      model: "gpt-5.6-luna",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(AgentRuntimeNotFoundError);
      expect(result.error.message).toContain("missing-runtime");
    }
    expect(mockJobsDao.create).not.toHaveBeenCalled();
    expect(mockPipelineRunExecutorRun).not.toHaveBeenCalled();
  });

  it("rejects a run before creating a job when an Operation reference is missing", async () => {
    mockPipelinesDao.findById.mockResolvedValueOnce({
      id: "pipe-1",
      name: "Pipe",
      description: "Pipeline description",
      projectId: null,
      nodes: [
        {
          id: "search-node",
          type: "operation",
          data: {
            nodeType: "operation",
            operationId: "op_new_search_hackathons",
            operationName: "Search recent hackathons",
          },
        },
      ],
      edges: [],
    });
    const service = makeService();

    const result = await service.startRun({ pipelineId: "pipe-1" });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toMatchObject({
        code: "PIPELINE_OPERATION_MISSING",
        pipelineId: "pipe-1",
        missingOperations: [{ nodeId: "search-node", operationId: "op_new_search_hackathons" }],
      });
    }
    expect(mockJobsDao.create).not.toHaveBeenCalled();
    expect(mockPipelineRunExecutorRun).not.toHaveBeenCalled();
  });

  it("rejects a legacy run with a blank Operation registry id before creating a job", async () => {
    mockPipelinesDao.findById.mockResolvedValueOnce({
      id: "pipe-1",
      name: "Pipe",
      description: "Pipeline description",
      projectId: null,
      nodes: [
        {
          id: "operation-node",
          type: "operation",
          data: {
            nodeType: "operation",
            operationId: "",
            operationName: "",
          },
        },
      ],
      edges: [],
    });
    const service = makeService();

    const result = await service.startRun({ pipelineId: "pipe-1" });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toMatchObject({
        code: "PIPELINE_OPERATION_MISSING",
        missingOperations: [{ nodeId: "operation-node", operationId: "" }],
      });
    }
    expect(mockJobsDao.create).not.toHaveBeenCalled();
    expect(mockPipelineRunExecutorRun).not.toHaveBeenCalled();
  });
});

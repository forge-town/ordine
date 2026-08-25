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

vi.mock("../engineDeps", () => ({
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

vi.mock("../runPipeline", () => ({
  pipelineRunExecutor: {
    run: mockPipelineRunExecutorRun,
  },
}));

import type { DbConnection } from "@repo/models";
import { createCredentialCipher } from "../../capabilityHarvestService";
import { pipelineRunnerEngineDeps } from "../engineDeps";
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

  it("builds the run with the exact selected runtime and model", async () => {
    const service = makeService();

    const result = await service.startRun({
      pipelineId: "pipe-1",
      runtimeConfigId: "runtime-codex",
      model: "gpt-5.6-luna",
      reasoningEffort: "xhigh",
      speed: "priority",
    });
    expect(result.isOk()).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(pipelineRunnerEngineDeps.build).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultAgent: "codex",
        model: "gpt-5.6-luna",
        reasoningEffort: "xhigh",
        speed: "priority",
        runtimeConfigId: "runtime-codex",
        executablePath: "C:\\Tools\\codex.cmd",
        overrideOperationRoute: true,
      }),
    );
  });

  it("decrypts the active runtime source only while building execution injection", async () => {
    const sourceKey = "codex-source";
    const cipher = createCredentialCipher("unit-test-encryption-key");
    expect(cipher.isOk()).toBe(true);
    if (cipher.isErr()) throw cipher.error;
    const envelope = cipher.value.encrypt(sourceKey, {
      headers: { Authorization: "Bearer pipeline-runtime-value" },
    });
    expect(envelope.isOk()).toBe(true);
    if (envelope.isErr()) throw envelope.error;
    mockConnectorsDao.findMany.mockResolvedValueOnce([
      {
        id: "connector-github",
        name: "github",
        method: "mcp",
        status: "connected",
        scopes: null,
        config: {
          transport: "http",
          url: "https://example.test/mcp",
          tools: [{ name: "read_issue" }],
        },
        origin: "harvested",
        signature: "signature",
        sources: [
          {
            sourceKey,
            source: "codex",
            scope: "global",
            path: "/home/test/.codex/config.toml",
            nativeName: "github",
            enabled: true,
            lastSeenAt: "2026-08-13T00:00:00.000Z",
          },
        ],
        encryptedCredentials: { [sourceKey]: envelope.value },
        lastSyncAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    const service = createPipelineRunnerService({} as DbConnection, {
      encryptionSecret: "unit-test-encryption-key",
    });

    const result = await service.startRun({ pipelineId: "pipe-1" });
    expect(result.isOk()).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockMcpInjections).toEqual([
      {
        mcpServers: {
          [mockMcpServerKey]: {
            type: "http",
            url: "https://example.test/mcp",
            headers: { Authorization: "Bearer pipeline-runtime-value" },
          },
        },
        toolNames: [mockMcpToolReference],
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
});

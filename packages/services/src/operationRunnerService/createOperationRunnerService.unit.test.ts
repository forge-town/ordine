import { describe, it, expect, vi, beforeEach } from "vitest";

const mockOperationsDao = {
  findById: vi.fn(),
};

const mockJobsDao = {
  create: vi.fn().mockResolvedValue(undefined),
  updateStatus: vi.fn().mockResolvedValue(undefined),
};

const mockSettingsDao = {
  get: vi.fn().mockResolvedValue({
    id: "default",
    defaultAgentRuntime: "mastra",
    defaultApiKey: null,
    defaultModel: null,
    defaultOutputPath: null,
  }),
};

const mockAgentRuntimesDao = {
  findMany: vi.fn().mockResolvedValue([]),
};

const mockSkillsDao = {
  findById: vi.fn().mockResolvedValue(null),
  findByName: vi.fn().mockResolvedValue(null),
};

const mockBestPracticesDao = {
  findById: vi.fn().mockResolvedValue(null),
};

const mockAgentsDao = {
  findById: vi.fn().mockResolvedValue(null),
};

vi.mock("@repo/models", () => ({
  createOperationsDao: () => mockOperationsDao,
  createJobsDao: () => mockJobsDao,
  createJobTracesDao: () => ({ create: vi.fn() }),
  createSkillsDao: () => mockSkillsDao,
  createBestPracticesDao: () => mockBestPracticesDao,
  createAgentsDao: () => mockAgentsDao,
  createAgentRawExportsDao: () => ({ create: vi.fn() }),
  createAgentSpansDao: () => ({ create: vi.fn() }),
  createSettingsDao: () => mockSettingsDao,
  createAgentRuntimesDao: () => mockAgentRuntimesDao,
  createPipelinesDao: () => ({}),
  createPipelineRunsDao: () => ({}),
}));

vi.mock("@repo/obs", () => ({
  initObs: vi.fn(),
  initSpanRecorder: vi.fn(),
  trace: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@repo/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  createOperationRunnerService,
  OperationNotFoundError,
} from "./createOperationRunnerService";

describe("createOperationRunnerService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns OperationNotFoundError when operation does not exist", async () => {
    mockOperationsDao.findById.mockResolvedValueOnce(undefined);

    const svc = createOperationRunnerService({} as never);
    const result = await svc.startRun({ operationId: "nonexistent" });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(OperationNotFoundError);
      expect(result.error.message).toContain("nonexistent");
    }
  });

  it("creates a job and returns jobId when operation exists", async () => {
    mockOperationsDao.findById.mockResolvedValueOnce({
      id: "op-1",
      name: "Test Op",
      config: { executor: { type: "script", command: "echo hello" } },
      acceptedObjectTypes: ["file"],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const svc = createOperationRunnerService({} as never);
    const result = await svc.startRun({
      operationId: "op-1",
      inputContent: "test input",
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.jobId).toBeDefined();
      expect(typeof result.value.jobId).toBe("string");
    }

    expect(mockJobsDao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Run operation: Test Op",
        type: "operation_run",
        status: "queued",
      }),
    );
  });

  it("passes inputPath and inputContent through to execution", async () => {
    mockOperationsDao.findById.mockResolvedValueOnce({
      id: "op-2",
      name: "Path Op",
      config: { executor: { type: "script", command: "cat" } },
      acceptedObjectTypes: ["file"],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const svc = createOperationRunnerService({} as never);
    const result = await svc.startRun({
      operationId: "op-2",
      inputPath: "/some/file.ts",
      inputContent: "file content here",
    });

    expect(result.isOk()).toBe(true);
  });
});

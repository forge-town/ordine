import { beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "@repo/logger";

const mockSettingsDao = {
  get: vi.fn().mockResolvedValue({
    defaultAgentRuntime: "codex",
    defaultApiKey: "test-key",
    defaultModel: "gpt-5.4-mini",
  }),
};
const mockOperationsDao = {
  findMany: vi.fn().mockResolvedValue([]),
};
const mockAgentRuntimesDao = {
  findMany: vi.fn().mockResolvedValue([
    {
      id: "runtime-codex",
      name: "Codex Local",
      type: "codex",
      connection: { mode: "local" },
    },
  ]),
};
const mockConversationMessagesDao = {
  findManyByPipelineId: vi.fn().mockResolvedValue([]),
};
const mockJobsDao = {
  findById: vi.fn(),
};
const mockJobTracesDao = {
  findByJobId: vi.fn(),
};
const mockRunProposeAgent = vi.fn();

vi.mock("@repo/models", () => ({
  createAgentRuntimesDao: () => mockAgentRuntimesDao,
  createConversationMessagesDao: () => mockConversationMessagesDao,
  createJobsDao: () => mockJobsDao,
  createJobTracesDao: () => mockJobTracesDao,
  createOperationsDao: () => mockOperationsDao,
  createSettingsDao: () => mockSettingsDao,
}));
vi.mock("@repo/logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));
vi.mock("./runProposeAgent", () => ({
  runProposeAgent: (opts: unknown) => mockRunProposeAgent(opts),
}));

import { proposeActions } from "./proposeActions";

const snapshot = {
  nodes: [
    {
      id: "folder-1",
      type: "folder",
      position: { x: 0, y: 0 },
      data: { nodeType: "folder", label: "Folder 1", folderPath: "/tmp/source" },
    },
  ],
  edges: [],
} as never;

const makeContext = (runState?: {
  jobId: string;
  nodeStatuses: Record<string, string>;
  status: string;
}) => ({
  anchors: [],
  selection: [],
  snapshotIncluded: false,
  threadWindow: { enabled: false, limit: 10 },
  ...(runState ? { runState } : {}),
});

describe("proposeActions", () => {
  beforeEach(() => {
    mockRunProposeAgent.mockReset();
    mockJobsDao.findById.mockReset();
    mockJobTracesDao.findByJobId.mockReset();
    mockOperationsDao.findMany.mockReset();
    mockOperationsDao.findMany.mockResolvedValue([]);
    vi.mocked(logger.warn).mockClear();
    vi.mocked(logger.error).mockClear();
  });

  it("returns a generic client detail and logs the full detail on AGENT_FAILED", async () => {
    mockRunProposeAgent.mockResolvedValue({
      ok: false,
      code: "AGENT_FAILED",
      detail: "spawn failure at /Users/alanyu/.codex/bin",
    });

    const result = await proposeActions(
      {
        agentRuntimesDao: mockAgentRuntimesDao as never,
        conversationMessagesDao: mockConversationMessagesDao as never,
        jobsDao: mockJobsDao as never,
        jobTracesDao: mockJobTracesDao as never,
        operationsDao: mockOperationsDao as never,
        settingsDao: mockSettingsDao as never,
      },
      { snapshot, message: "do something" },
    );

    expect(result).toStrictEqual({
      proposal: null,
      diagnostics: [],
      error: { code: "AGENT_FAILED", detail: "agent failed after retries" },
    });
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.stringContaining("/Users/alanyu/.codex/bin"),
      }),
      "proposeActions: agent failed after retries",
    );
  });

  it("binds active-run context to the current pipeline", async () => {
    mockJobsDao.findById.mockResolvedValue({
      id: "job-1",
      pipelineId: "pipe-1",
      status: "running",
    });
    mockJobTracesDao.findByJobId.mockResolvedValue([{ level: "info", message: "trace" }]);
    mockRunProposeAgent.mockResolvedValue({
      ok: true,
      json: {
        reply: "done",
        proposal: { summary: "noop", actions: [] },
      },
    });

    await proposeActions(
      {
        agentRuntimesDao: mockAgentRuntimesDao as never,
        conversationMessagesDao: mockConversationMessagesDao as never,
        jobsDao: mockJobsDao as never,
        jobTracesDao: mockJobTracesDao as never,
        operationsDao: mockOperationsDao as never,
        settingsDao: mockSettingsDao as never,
      },
      {
        snapshot,
        message: "do something",
        pipelineId: "pipe-1",
        context: makeContext({ jobId: "job-1", nodeStatuses: {}, status: "running" }) as never,
      },
    );

    expect(mockJobsDao.findById).toHaveBeenCalledWith("job-1");
    expect(mockJobTracesDao.findByJobId).toHaveBeenCalledWith("job-1");
  });

  it("rejects a runState job that belongs to a different pipeline", async () => {
    mockJobsDao.findById.mockResolvedValue({
      id: "job-1",
      pipelineId: "pipe-other",
      status: "running",
    });
    mockRunProposeAgent.mockResolvedValue({
      ok: true,
      json: {
        reply: "done",
        proposal: { summary: "noop", actions: [] },
      },
    });

    await proposeActions(
      {
        agentRuntimesDao: mockAgentRuntimesDao as never,
        conversationMessagesDao: mockConversationMessagesDao as never,
        jobsDao: mockJobsDao as never,
        jobTracesDao: mockJobTracesDao as never,
        operationsDao: mockOperationsDao as never,
        settingsDao: mockSettingsDao as never,
      },
      {
        snapshot,
        message: "do something",
        pipelineId: "pipe-1",
        context: makeContext({ jobId: "job-1", nodeStatuses: {}, status: "running" }) as never,
      },
    );

    expect(mockJobTracesDao.findByJobId).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ jobPipelineId: "pipe-other", pipelineId: "pipe-1" }),
      "proposeActions: runState job does not belong to current pipeline",
    );
  });
});

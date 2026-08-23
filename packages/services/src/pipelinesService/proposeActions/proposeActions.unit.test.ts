import { beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "@repo/logger";
import type { CapabilityCatalogEntry } from "@repo/schemas";
import { errAsync, okAsync } from "neverthrow";

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
const mockCapabilityCatalog = {
  getMany: vi.fn(() => okAsync([] as CapabilityCatalogEntry[])),
  validateOperationConfigs: vi.fn(() => okAsync(undefined)),
};

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
    mockAgentRuntimesDao.findMany.mockReset();
    mockAgentRuntimesDao.findMany.mockResolvedValue([
      {
        id: "runtime-codex",
        name: "Codex Local",
        type: "codex",
        connection: { mode: "local" },
      },
    ]);
    mockCapabilityCatalog.getMany.mockReset();
    mockCapabilityCatalog.getMany.mockReturnValue(okAsync([]));
    mockCapabilityCatalog.validateOperationConfigs.mockReset();
    mockCapabilityCatalog.validateOperationConfigs.mockReturnValue(okAsync(undefined));
    vi.mocked(logger.warn).mockClear();
    vi.mocked(logger.error).mockClear();
  });

  it("forwards the selected runtime controls to the durable projection run", async () => {
    mockRunProposeAgent.mockResolvedValueOnce({
      ok: true,
      json: {
        reply: "Removed the stale node.",
        proposal: {
          summary: "Remove stale node",
          actions: [{ type: "removeNode", nodeId: "folder-1" }],
        },
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
        capabilityCatalog: mockCapabilityCatalog,
      },
      {
        snapshot,
        message: "Remove the stale node",
        runtimeId: "runtime-codex",
        model: "gpt-5.6-sol",
        reasoningEffort: "xhigh",
        speed: "priority",
        firstOutputTimeoutMs: 180_000,
        jobId: "session-1",
        agentId: "pipeline-agent-projection",
      },
    );

    expect(mockRunProposeAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-5.6-sol",
        reasoningEffort: "xhigh",
        speed: "priority",
        firstOutputTimeoutMs: 180_000,
        runtimeConfigId: "runtime-codex",
        jobId: "session-1",
        agentId: "pipeline-agent-projection",
      }),
    );
  });

  it("accepts a catalog-valid updateOperation for an operation in the graph", async () => {
    mockAgentRuntimesDao.findMany.mockResolvedValueOnce([
      {
        id: "runtime-claude",
        name: "Claude Local",
        type: "claude-code",
        connection: {
          mode: "local",
          models: [{ id: "claude-review", displayName: "Review" }],
        },
      },
    ]);
    mockOperationsDao.findMany.mockResolvedValueOnce([
      {
        id: "op-review",
        name: "Review",
        description: "Review changes",
        acceptedObjectTypes: ["folder"],
        config: { executor: { type: "agent", prompt: "Old prompt" } },
      },
    ]);
    mockCapabilityCatalog.getMany.mockReturnValueOnce(
      okAsync([
        {
          id: "builtin:Read",
          reference: "Read",
          displayName: "Read",
          description: "Read files",
          source: "builtin",
          supportedRuntimes: ["claude-code"],
          riskTier: "readonly",
          inferredRiskTier: "readonly",
          riskTierSource: "rule",
          kind: "builtin-tool",
        },
      ]),
    );
    const executor = {
      type: "agent",
      agentMode: "prompt",
      agent: "claude-code",
      model: "claude-review",
      prompt: "Review the supplied diff.",
      allowedTools: ["Read"],
      assignmentReason: "Semantic review needs read-only repository access.",
    };
    mockRunProposeAgent.mockResolvedValueOnce({
      ok: true,
      json: {
        reply: "Updated the review executor.",
        proposal: {
          summary: "Update review executor",
          actions: [{ type: "updateOperation", operationId: "op-review", executor }],
        },
      },
    });
    const operationSnapshot = {
      nodes: [
        {
          id: "review-node",
          type: "operation",
          position: { x: 0, y: 0 },
          data: {
            nodeType: "operation",
            label: "Review",
            operationId: "op-review",
            operationName: "Review",
            status: "idle",
          },
        },
      ],
      edges: [],
    } as never;

    const result = await proposeActions(
      {
        agentRuntimesDao: mockAgentRuntimesDao as never,
        conversationMessagesDao: mockConversationMessagesDao as never,
        jobsDao: mockJobsDao as never,
        jobTracesDao: mockJobTracesDao as never,
        operationsDao: mockOperationsDao as never,
        settingsDao: mockSettingsDao as never,
        capabilityCatalog: mockCapabilityCatalog,
      },
      { snapshot: operationSnapshot, message: "Use the review model" },
    );

    expect(result.proposal?.actions).toEqual([
      { type: "updateOperation", operationId: "op-review", executor },
    ]);
    expect(result.error).toBeUndefined();
    expect(mockCapabilityCatalog.validateOperationConfigs).toHaveBeenCalledOnce();
  });

  it("keeps graph-only proposals available when the capability catalog cannot load", async () => {
    mockCapabilityCatalog.getMany.mockReturnValueOnce(
      errAsync(new Error("catalog unavailable")) as never,
    );
    mockRunProposeAgent.mockResolvedValueOnce({
      ok: true,
      json: {
        reply: "Removed the stale node.",
        proposal: {
          summary: "Remove stale node",
          actions: [{ type: "removeNode", nodeId: "folder-1" }],
        },
      },
    });

    const result = await proposeActions(
      {
        agentRuntimesDao: mockAgentRuntimesDao as never,
        conversationMessagesDao: mockConversationMessagesDao as never,
        jobsDao: mockJobsDao as never,
        jobTracesDao: mockJobTracesDao as never,
        operationsDao: mockOperationsDao as never,
        settingsDao: mockSettingsDao as never,
        capabilityCatalog: mockCapabilityCatalog,
      },
      { snapshot, message: "Remove the stale node" },
    );

    expect(result.proposal?.actions).toEqual([{ type: "removeNode", nodeId: "folder-1" }]);
    expect(result.error).toBeUndefined();
    expect(mockCapabilityCatalog.validateOperationConfigs).not.toHaveBeenCalled();
  });

  it("repairs an invalid updateOperation once, then rejects it without a proposal", async () => {
    mockAgentRuntimesDao.findMany.mockResolvedValue([
      {
        id: "runtime-codex",
        name: "Codex Local",
        type: "codex",
        connection: {
          mode: "local",
          models: [{ id: "gpt-review", displayName: "Review" }],
        },
      },
    ]);
    mockOperationsDao.findMany.mockResolvedValue([
      {
        id: "op-review",
        name: "Review",
        description: "Review changes",
        acceptedObjectTypes: ["folder"],
        config: { executor: { type: "agent", prompt: "Old prompt" } },
      },
    ]);
    mockCapabilityCatalog.getMany.mockReturnValue(okAsync([]));
    const invalidOutput = {
      reply: "Updated.",
      proposal: {
        summary: "Update review executor",
        actions: [
          {
            type: "updateOperation",
            operationId: "op-review",
            executor: {
              type: "agent",
              agentMode: "prompt",
              agent: "codex",
              model: "invented-model",
              prompt: "Review it.",
              allowedTools: ["invented-tool"],
              assignmentReason: "Review needs a model.",
            },
          },
        ],
      },
    };
    mockRunProposeAgent.mockResolvedValue({ ok: true, json: invalidOutput });
    const operationSnapshot = {
      nodes: [
        {
          id: "review-node",
          type: "operation",
          position: { x: 0, y: 0 },
          data: {
            nodeType: "operation",
            label: "Review",
            operationId: "op-review",
            operationName: "Review",
            status: "idle",
          },
        },
      ],
      edges: [],
    } as never;

    const result = await proposeActions(
      {
        agentRuntimesDao: mockAgentRuntimesDao as never,
        conversationMessagesDao: mockConversationMessagesDao as never,
        jobsDao: mockJobsDao as never,
        jobTracesDao: mockJobTracesDao as never,
        operationsDao: mockOperationsDao as never,
        settingsDao: mockSettingsDao as never,
        capabilityCatalog: mockCapabilityCatalog,
      },
      { snapshot: operationSnapshot, message: "Change it" },
    );

    expect(mockRunProposeAgent).toHaveBeenCalledTimes(2);
    expect(result.proposal).toBeNull();
    expect(result.error).toEqual({
      code: "BAD_AGENT_OUTPUT",
      detail: "updateOperation failed validation",
    });
    expect(result.diagnostics.map((diagnostic) => diagnostic.message).join("\n")).toContain(
      "off-catalog agent/model pair",
    );
  });

  it("rejects updateOperation for an existing Operation outside the current graph", async () => {
    mockAgentRuntimesDao.findMany.mockResolvedValue([
      {
        id: "runtime-codex",
        name: "Codex Local",
        type: "codex",
        connection: {
          mode: "local",
          models: [{ id: "gpt-review", displayName: "Review" }],
        },
      },
    ]);
    mockOperationsDao.findMany.mockResolvedValue([
      {
        id: "op-review",
        name: "Review",
        description: "Review changes",
        acceptedObjectTypes: ["folder"],
        config: { executor: { type: "agent", prompt: "Old prompt" } },
      },
    ]);
    const invalidOutput = {
      reply: "Updated.",
      proposal: {
        summary: "Update an unrelated executor",
        actions: [
          {
            type: "updateOperation",
            operationId: "op-review",
            executor: {
              type: "agent",
              agentMode: "prompt",
              agent: "codex",
              model: "gpt-review",
              prompt: "Review it.",
              allowedTools: [],
              assignmentReason: "Semantic review needs model judgment.",
            },
          },
        ],
      },
    };
    mockRunProposeAgent.mockResolvedValue({ ok: true, json: invalidOutput });

    const result = await proposeActions(
      {
        agentRuntimesDao: mockAgentRuntimesDao as never,
        conversationMessagesDao: mockConversationMessagesDao as never,
        jobsDao: mockJobsDao as never,
        jobTracesDao: mockJobTracesDao as never,
        operationsDao: mockOperationsDao as never,
        settingsDao: mockSettingsDao as never,
        capabilityCatalog: mockCapabilityCatalog,
      },
      { snapshot, message: "Change the unrelated operation" },
    );

    expect(mockRunProposeAgent).toHaveBeenCalledTimes(2);
    expect(result.proposal).toBeNull();
    expect(result.diagnostics.map((diagnostic) => diagnostic.message).join("\n")).toContain(
      "used by the current pipeline",
    );
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
        capabilityCatalog: mockCapabilityCatalog,
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
        capabilityCatalog: mockCapabilityCatalog,
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
        capabilityCatalog: mockCapabilityCatalog,
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

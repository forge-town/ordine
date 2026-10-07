import { beforeEach, describe, it, expect, vi } from "vitest";

import { okAsync } from "neverthrow";

const mockDao = {
  findMany: vi.fn().mockResolvedValue([{ id: "p1" }]),
  findById: vi.fn().mockResolvedValue({ id: "p1" }),
  create: vi.fn().mockResolvedValue({ id: "p1" }),
  update: vi.fn().mockResolvedValue({ id: "p1" }),
  delete: vi.fn().mockResolvedValue(undefined),
};

const mockSettingsDao = {
  get: vi.fn().mockResolvedValue({
    defaultAgentRuntime: "codex",
    defaultApiKey: "test-key",
    defaultModel: "gpt-5.4-mini",
  }),
};

const mockOperationsDao = {
  create: vi.fn(),
  findMany: vi.fn().mockResolvedValue([
    {
      id: "op-known",
      name: "Known Operation",
      description: "Known operation description",
      acceptedObjectTypes: ["folder"],
    },
  ]),
  findById: vi.fn(),
  update: vi.fn(),
};

const mockAgentRuntimesDao = {
  findMany: vi.fn().mockResolvedValue([
    {
      id: "runtime-codex",
      name: "Codex Local",
      type: "codex",
      connection: { mode: "local" },
    },
    {
      id: "runtime-claude-ssh",
      name: "Claude SSH",
      type: "claude-code",
      connection: { mode: "ssh", host: "example.com", user: "ubuntu", port: 22 },
    },
  ]),
};

const mockRunAgent = vi.fn();

const mockExtractJsonFromText = vi.fn((raw: string) => raw);

const mockDistillationsDao = {
  findById: vi.fn(),
};

const mockConversationMessagesDao = {
  findManyByPipelineId: vi.fn().mockResolvedValue([]),
};

const mockCapabilityCatalog = {
  getMany: vi.fn(() => okAsync([])),
  validateOperationConfig: vi.fn(() => okAsync(undefined)),
  validateOperationConfigs: vi.fn(() => okAsync(undefined)),
};

vi.mock("@repo/models", () => ({
  createAgentRuntimesDao: () => mockAgentRuntimesDao,
  createCapabilityRiskOverridesDao: () => ({ findMany: vi.fn().mockResolvedValue([]) }),
  createConnectorsDao: () => ({ findMany: vi.fn().mockResolvedValue([]) }),
  createConversationMessagesDao: () => mockConversationMessagesDao,
  createPipelinesDao: (executor: { pipelinesDao?: typeof mockDao }) =>
    executor?.pipelinesDao ?? mockDao,
  createDistillationsDao: () => mockDistillationsDao,
  createJobsDao: () => ({}),
  createPipelineRunsDao: () => ({
    findByJobId: vi.fn(),
    deleteByPipelineId: vi.fn().mockResolvedValue(undefined),
  }),
  createJobTracesDao: () => ({}),
  createAgentRawExportsDao: () => ({}),
  createAgentSpansDao: () => ({}),
  createOperationsDao: (executor: { operationsDao?: typeof mockOperationsDao }) =>
    executor?.operationsDao ?? mockOperationsDao,
  createOperationRegistryRepository: (executor: {
    transaction?: (
      callback: (transaction: unknown) => Promise<unknown>,
      config?: unknown,
    ) => Promise<unknown>;
    operationsDao?: typeof mockOperationsDao;
    pipelinesDao?: typeof mockDao;
  }) => ({
    runSerializable: (callback: (transaction: unknown) => Promise<unknown>) => {
      const run = (transaction: typeof executor) =>
        callback({
          executor: transaction,
          operationsDao: transaction?.operationsDao ?? mockOperationsDao,
          pipelinesDao: transaction?.pipelinesDao ?? mockDao,
        });

      return executor?.transaction
        ? executor.transaction((transaction) => run(transaction as typeof executor), {
            isolationLevel: "serializable",
          })
        : run(executor);
    },
  }),
  createSettingsDao: () => mockSettingsDao,
  createSkillsDao: () => ({
    findMany: vi.fn().mockResolvedValue([]),
    seedIfEmpty: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("@repo/agent", () => ({
  extractJsonFromText: (raw: string) => mockExtractJsonFromText(raw),
}));

vi.mock("../../../pipelineRunnerService/helpers/agentRunner/agentRunner.helper", () => ({
  runAgent: (opts: unknown) => mockRunAgent(opts),
}));

vi.mock("../../../capabilityCatalogService", () => ({
  createCapabilityCatalogService: () => mockCapabilityCatalog,
}));

import { createPipelinesService } from "../..";

describe("createPipelinesService", () => {
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

  const compoundSnapshot = {
    nodes: [
      {
        id: "compound-1",
        type: "compound",
        position: { x: 0, y: 0 },
        data: { nodeType: "compound", label: "Group 1", childNodeIds: [] },
      },
    ],
    edges: [],
  } as never;

  const resetCommonMocks = () => {
    mockDao.findMany.mockClear();
    mockDao.findById.mockClear();
    mockDao.create.mockClear();
    mockDao.update.mockClear();
    mockDao.delete.mockClear();
    mockSettingsDao.get.mockClear();
    mockOperationsDao.findMany.mockClear();
    mockOperationsDao.create.mockClear();
    mockOperationsDao.findById.mockReset();
    mockOperationsDao.update.mockReset();
    mockAgentRuntimesDao.findMany.mockClear();
    mockRunAgent.mockReset();
    mockExtractJsonFromText.mockReset();
    mockExtractJsonFromText.mockImplementation((raw: string) => raw);
    mockDistillationsDao.findById.mockReset();
    mockConversationMessagesDao.findManyByPipelineId.mockClear();
    mockConversationMessagesDao.findManyByPipelineId.mockResolvedValue([]);
    mockCapabilityCatalog.getMany.mockClear();
    mockCapabilityCatalog.validateOperationConfig.mockClear();
    mockCapabilityCatalog.validateOperationConfigs.mockClear();
  };

  beforeEach(() => {
    resetCommonMocks();
  });

  it("proposeActions injects conversation history into the user prompt", async () => {
    mockConversationMessagesDao.findManyByPipelineId.mockResolvedValue([
      { content: "build a quiz pipeline", metadata: null, role: "user" },
      { content: "Drafted it.", metadata: { proposalSnapshot: {} }, role: "agent" },
      { content: "再加一个校验步骤", metadata: null, role: "user" },
    ] as never);
    mockRunAgent.mockResolvedValue(
      JSON.stringify({
        summary: "remove stale node",
        actions: [{ type: "removeNode", nodeId: "folder-1" }],
      }),
    );
    const svc = createPipelinesService({} as never);

    await svc.proposeActions({
      snapshot,
      message: "再加一个校验步骤",
      pipelineId: "p1",
    });

    const callArgs = mockRunAgent.mock.calls[0]?.[0] as { userPrompt: string };
    expect(mockConversationMessagesDao.findManyByPipelineId).toHaveBeenCalledWith("p1");
    expect(callArgs.userPrompt).toContain("=== CONVERSATION HISTORY (oldest first) ===");
    expect(callArgs.userPrompt).toContain("[user]: build a quiz pipeline");
    expect(callArgs.userPrompt).toContain("[assistant] (included a graph proposal): Drafted it.");
    // The current message already sits in the USER REQUEST section; it must
    // not repeat inside the history block.
    expect(callArgs.userPrompt).not.toContain("[user]: 再加一个校验步骤");
  });
});

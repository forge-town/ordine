import { beforeEach, describe, it, expect, vi } from "vitest";
import { errAsync, ok, okAsync } from "neverthrow";

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
  createSettingsDao: () => mockSettingsDao,
  createSkillsDao: () => ({
    findMany: vi.fn().mockResolvedValue([]),
    seedIfEmpty: vi.fn().mockResolvedValue(undefined),
  }),
}));
vi.mock("@repo/agent", () => ({
  extractJsonFromText: (raw: string) => mockExtractJsonFromText(raw),
}));
vi.mock("../pipelineRunnerService/agentRunner/agentRunner", () => ({
  runAgent: (opts: unknown) => mockRunAgent(opts),
}));
vi.mock("../capabilityCatalogService", () => ({
  createCapabilityCatalogService: () => mockCapabilityCatalog,
}));

import { createPipelinesService } from "./createPipelinesService";

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

  it("optimizeFromDistillation returns undefined (never throws) on malformed agent JSON", async () => {
    mockDistillationsDao.findById.mockResolvedValue({
      id: "dist-1",
      sourceType: "manual",
      sourceId: null,
      result: { summary: "distilled summary" },
    });
    mockRunAgent.mockResolvedValue("this is not json {{{");

    const svc = createPipelinesService({} as never);

    await expect(
      svc.optimizeFromDistillation({ distillationId: "dist-1", userPrompt: "optimize it" }),
    ).resolves.toBeUndefined();
  });

  it("getAll delegates to dao.findMany", async () => {
    const svc = createPipelinesService({} as never);
    const result = await svc.getAll();
    expect(mockDao.findMany).toHaveBeenCalled();
    expect(result).toEqual([{ id: "p1" }]);
  });

  it("getById delegates to dao.findById", async () => {
    const svc = createPipelinesService({} as never);
    await svc.getById("p1");
    expect(mockDao.findById).toHaveBeenCalledWith("p1");
  });

  it("create delegates to dao.create", async () => {
    const svc = createPipelinesService({} as never);
    const data = { name: "pipeline" } as never;
    const result = await svc.create(data);

    expect(result.isOk()).toBe(true);
    expect(mockDao.create).toHaveBeenCalledWith(data);
  });

  it("rejects a Pipeline that references an Operation missing from persistence", async () => {
    const svc = createPipelinesService({} as never);
    const data = {
      id: "pipeline-missing-operation",
      name: "Broken Pipeline",
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
    } as never;

    const result = await svc.create(data);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toMatchObject({
        name: "PipelineOperationReferencesError",
        code: "PIPELINE_OPERATION_MISSING",
        pipelineId: "pipeline-missing-operation",
        missingOperations: [{ nodeId: "search-node", operationId: "op_new_search_hackathons" }],
      });
    }
    expect(mockDao.create).not.toHaveBeenCalled();
  });

  it("rejects an Operation node whose registry id is blank", async () => {
    const svc = createPipelinesService({} as never);
    const data = {
      id: "pipeline-blank-operation",
      name: "Incomplete Pipeline",
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
    } as never;

    const result = await svc.create(data);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toMatchObject({
        code: "PIPELINE_OPERATION_MISSING",
        missingOperations: [{ nodeId: "operation-node", operationId: "" }],
      });
    }
    expect(mockDao.create).not.toHaveBeenCalled();
  });

  it("saves a Pipeline when all referenced Operations exist", async () => {
    mockOperationsDao.findById.mockResolvedValueOnce({ id: "op-existing" });
    const svc = createPipelinesService({} as never);
    const data = {
      id: "pipeline-valid",
      name: "Valid Pipeline",
      nodes: [
        {
          id: "operation-node",
          type: "operation",
          data: {
            nodeType: "operation",
            operationId: "op-existing",
            operationName: "Existing Operation",
          },
        },
      ],
    } as never;

    const result = await svc.create(data);

    expect(result.isOk()).toBe(true);
    expect(mockOperationsDao.findById).toHaveBeenCalledWith("op-existing");
    expect(mockDao.create).toHaveBeenCalledWith(data);
  });

  it("update delegates to dao.update", async () => {
    const svc = createPipelinesService({} as never);
    const result = await svc.update("p1", { name: "updated" } as never);

    expect(result.isOk()).toBe(true);
    expect(mockDao.update).toHaveBeenCalledWith("p1", { name: "updated" });
  });

  it("rejects an update that introduces a missing Operation reference", async () => {
    mockDao.findById.mockResolvedValueOnce({ id: "p1", nodes: [] });
    const svc = createPipelinesService({} as never);
    const patch = {
      nodes: [
        {
          id: "missing-node",
          type: "operation",
          data: {
            nodeType: "operation",
            operationId: "op-missing",
            operationName: "Missing",
          },
        },
      ],
    } as never;

    const result = await svc.update("p1", patch);

    expect(result.isErr()).toBe(true);
    expect(mockDao.update).not.toHaveBeenCalled();
  });

  it("delete delegates to dao.delete", async () => {
    const svc = createPipelinesService({} as never);
    await svc.delete("p1");
    expect(mockDao.delete).toHaveBeenCalledWith("p1");
  });

  it("rolls back the whole pending-operation batch when the second insert fails", async () => {
    const persistedOperations: unknown[] = [];
    const transaction = vi.fn(async (callback: (executor: unknown) => Promise<unknown>) => {
      const stagedOperations: unknown[] = [];
      const operationsDao = {
        ...mockOperationsDao,
        create: vi.fn(async (operation: { id: string }) => {
          if (operation.id === "op-2") throw new Error("injected second insert failure");
          stagedOperations.push(operation);
        }),
      };

      const value = await callback({ operationsDao });
      persistedOperations.push(...stagedOperations);

      return value;
    });
    const service = createPipelinesService({ transaction } as never, {
      capabilityCatalog: {
        validateOperationInputs: vi.fn().mockResolvedValue(ok(undefined)),
      } as never,
    });

    const result = await service.createPendingOperations([
      {
        id: "op-1",
        name: "First",
        description: "first",
        config: {},
        acceptedObjectTypes: ["file"],
      },
      {
        id: "op-2",
        name: "Second",
        description: "second",
        config: {},
        acceptedObjectTypes: ["file"],
      },
    ]);

    expect(result.isErr()).toBe(true);
    expect(transaction).toHaveBeenCalledOnce();
    expect(persistedOperations).toEqual([]);
  });

  it("rolls back pending operations when the related pipeline insert fails", async () => {
    const persistedOperations: unknown[] = [];
    const transaction = vi.fn(async (callback: (executor: unknown) => Promise<unknown>) => {
      const stagedOperations: unknown[] = [];
      const value = await callback({
        operationsDao: {
          ...mockOperationsDao,
          create: vi.fn(async (operation: unknown) => stagedOperations.push(operation)),
        },
        pipelinesDao: {
          ...mockDao,
          create: vi.fn().mockRejectedValue(new Error("injected pipeline insert failure")),
        },
      });
      persistedOperations.push(...stagedOperations);

      return value;
    });
    const service = createPipelinesService({ transaction } as never, {
      capabilityCatalog: {
        validateOperationInputs: vi.fn().mockResolvedValue(ok(undefined)),
      } as never,
    });

    const result = await service.createWithPendingOperations(
      { id: "pipeline-1", name: "Pipeline" } as never,
      [
        {
          id: "op-1",
          name: "First",
          description: "first",
          config: {},
          acceptedObjectTypes: ["file"],
        },
      ],
    );

    expect(result.isErr()).toBe(true);
    expect(transaction).toHaveBeenCalledOnce();
    expect(persistedOperations).toEqual([]);
  });

  it("saves pending Operations and their Pipeline in one transaction", async () => {
    const persistedOperationIds: string[] = [];
    const persistedPipelineIds: string[] = [];
    const transaction = vi.fn(async (callback: (executor: unknown) => Promise<unknown>) => {
      const stagedOperationIds: string[] = [];
      const stagedPipelineIds: string[] = [];
      const value = await callback({
        operationsDao: {
          ...mockOperationsDao,
          create: vi.fn(async (operation: { id: string }) => stagedOperationIds.push(operation.id)),
          findById: vi.fn(async (id: string) =>
            stagedOperationIds.includes(id) ? { id } : undefined,
          ),
        },
        pipelinesDao: {
          ...mockDao,
          create: vi.fn(async (pipeline: { id: string }) => {
            stagedPipelineIds.push(pipeline.id);

            return pipeline;
          }),
        },
      });
      persistedOperationIds.push(...stagedOperationIds);
      persistedPipelineIds.push(...stagedPipelineIds);

      return value;
    });
    const service = createPipelinesService({ transaction } as never, {
      capabilityCatalog: {
        validateOperationInputs: vi.fn().mockResolvedValue(ok(undefined)),
      } as never,
    });

    const result = await service.createWithPendingOperations(
      {
        id: "pipeline-1",
        name: "Pipeline",
        nodes: [
          {
            id: "operation-node",
            type: "operation",
            data: {
              nodeType: "operation",
              operationId: "op-1",
              operationName: "First",
            },
          },
        ],
      } as never,
      [
        {
          id: "op-1",
          name: "First",
          description: "first",
          config: {},
          acceptedObjectTypes: ["file"],
        },
      ],
    );

    expect(result.isOk()).toBe(true);
    expect(persistedOperationIds).toEqual(["op-1"]);
    expect(persistedPipelineIds).toEqual(["pipeline-1"]);
  });

  it("rolls back pending Operations when the Pipeline still references a missing Operation", async () => {
    const persistedOperationIds: string[] = [];
    const persistedPipelineIds: string[] = [];
    const transaction = vi.fn(async (callback: (executor: unknown) => Promise<unknown>) => {
      const stagedOperationIds: string[] = [];
      const stagedPipelineIds: string[] = [];
      const value = await callback({
        operationsDao: {
          ...mockOperationsDao,
          create: vi.fn(async (operation: { id: string }) => stagedOperationIds.push(operation.id)),
          findById: vi.fn(async (id: string) =>
            stagedOperationIds.includes(id) ? { id } : undefined,
          ),
        },
        pipelinesDao: {
          ...mockDao,
          create: vi.fn(async (pipeline: { id: string }) => {
            stagedPipelineIds.push(pipeline.id);

            return pipeline;
          }),
        },
      });
      persistedOperationIds.push(...stagedOperationIds);
      persistedPipelineIds.push(...stagedPipelineIds);

      return value;
    });
    const service = createPipelinesService({ transaction } as never, {
      capabilityCatalog: {
        validateOperationInputs: vi.fn().mockResolvedValue(ok(undefined)),
      } as never,
    });

    const result = await service.createWithPendingOperations(
      {
        id: "pipeline-1",
        name: "Pipeline",
        nodes: [
          {
            id: "missing-node",
            type: "operation",
            data: {
              nodeType: "operation",
              operationId: "op-missing",
              operationName: "Missing",
            },
          },
        ],
      } as never,
      [
        {
          id: "op-1",
          name: "First",
          description: "first",
          config: {},
          acceptedObjectTypes: ["file"],
        },
      ],
    );

    expect(result.isErr()).toBe(true);
    expect(persistedOperationIds).toEqual([]);
    expect(persistedPipelineIds).toEqual([]);
  });

  it("updates a shared Operation executor while preserving ports", async () => {
    mockOperationsDao.findById.mockResolvedValueOnce({
      id: "op-known",
      config: {
        executor: { type: "agent", prompt: "Old prompt" },
        inputs: [{ name: "source", kind: "file", required: true }],
        outputs: [
          {
            name: "result",
            contentType: "markdown",
            description: "Review result",
            templateIds: [],
          },
        ],
      },
    });
    mockOperationsDao.update.mockResolvedValueOnce({ id: "op-known" });
    const capabilityCatalog = {
      validateOperationConfigs: vi.fn(() => okAsync(undefined)),
    };
    const executor = {
      type: "agent" as const,
      agentMode: "prompt" as const,
      agent: "codex" as const,
      model: "gpt-review",
      prompt: "Review the supplied diff.",
      allowedTools: ["Read"],
      assignmentReason: "Read-only repository access is sufficient for review.",
    };
    const svc = createPipelinesService({} as never, {
      capabilityCatalog: capabilityCatalog as never,
    });

    const result = await svc.updateOperationExecutors([{ operationId: "op-known", executor }]);

    expect(result.isOk()).toBe(true);
    expect(capabilityCatalog.validateOperationConfigs).toHaveBeenCalledOnce();
    expect(mockOperationsDao.update).toHaveBeenCalledWith("op-known", {
      config: expect.objectContaining({
        executor,
        inputs: [expect.objectContaining({ name: "source" })],
        outputs: [expect.objectContaining({ name: "result" })],
      }),
    });
  });

  it("rejects an off-catalog executor before updating the shared Operation", async () => {
    mockOperationsDao.findById.mockResolvedValueOnce({
      id: "op-known",
      config: { executor: { type: "agent", prompt: "Old prompt" }, inputs: [], outputs: [] },
    });
    const capabilityCatalog = {
      validateOperationConfigs: vi.fn(() => errAsync(new Error("off-catalog capability"))),
    };
    const svc = createPipelinesService({} as never, {
      capabilityCatalog: capabilityCatalog as never,
    });

    const result = await svc.updateOperationExecutors([
      {
        operationId: "op-known",
        executor: {
          type: "agent",
          agentMode: "prompt",
          agent: "codex",
          model: "gpt-review",
          prompt: "Review the supplied diff.",
          allowedTools: ["invented-tool"],
          assignmentReason: "Review needs repository access.",
        },
      },
    ]);

    expect(result.isErr()).toBe(true);
    expect(mockOperationsDao.update).not.toHaveBeenCalled();
  });

  it("proposeActions returns a parsed proposal and diagnostics", async () => {
    mockRunAgent.mockResolvedValue(
      JSON.stringify({
        summary: "remove stale node",
        actions: [{ type: "removeNode", nodeId: "folder-1" }],
      }),
    );
    const svc = createPipelinesService({} as never);

    const result = await svc.proposeActions({
      snapshot,
      message: "remove folder-1",
      pipelineId: "p1",
      pipelineName: "Pipeline 1",
    });

    expect(mockRunAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: "codex",
        allowedTools: [],
        agentId: "pipeline-propose-actions",
        userPrompt: expect.stringContaining("op-known"),
      }),
    );
    expect(mockOperationsDao.findMany).toHaveBeenCalled();
    expect(result.proposal).toEqual({
      summary: "remove stale node",
      actions: [{ type: "removeNode", nodeId: "folder-1" }],
    });
    expect(result.diagnostics).toEqual([]);
    expect(mockDao.create).not.toHaveBeenCalled();
    expect(mockDao.update).not.toHaveBeenCalled();
    expect(mockDao.delete).not.toHaveBeenCalled();
  });

  it("proposeActions surfaces reply and proposal from the new agent output format", async () => {
    mockRunAgent.mockResolvedValue(
      JSON.stringify({
        reply: "我移除了过期节点。",
        proposal: {
          summary: "remove stale node",
          actions: [{ type: "removeNode", nodeId: "folder-1" }],
        },
      }),
    );
    const svc = createPipelinesService({} as never);

    const result = await svc.proposeActions({
      snapshot,
      message: "删掉 folder-1",
      pipelineId: "p1",
    });

    expect(result.reply).toBe("我移除了过期节点。");
    expect(result.proposal).toEqual({
      summary: "remove stale node",
      actions: [{ type: "removeNode", nodeId: "folder-1" }],
    });
    expect(result.diagnostics).toEqual([]);
  });

  it("proposeActions returns clarify options without a proposal when the agent asks back", async () => {
    mockRunAgent.mockResolvedValue(
      JSON.stringify({
        reply: "你想处理哪种输入？",
        clarifyOptions: ["本地文件夹", "GitHub 仓库", "纯文本指令"],
        proposal: null,
      }),
    );
    const svc = createPipelinesService({} as never);

    const result = await svc.proposeActions({
      snapshot,
      message: "帮我处理一下文件",
      pipelineId: "p1",
    });

    expect(result.proposal).toBeNull();
    expect(result.reply).toBe("你想处理哪种输入？");
    expect(result.clarifyOptions).toEqual(["本地文件夹", "GitHub 仓库", "纯文本指令"]);
    expect(result.diagnostics).toEqual([]);
  });

  it("proposeActions keeps the reply when the structured proposal fails validation", async () => {
    mockRunAgent.mockResolvedValue(
      JSON.stringify({
        reply: "尝试修改图结构。",
        proposal: { summary: "broken", actions: [{ type: "unknownAction" }] },
      }),
    );
    const svc = createPipelinesService({} as never);

    const result = await svc.proposeActions({
      snapshot,
      message: "改一下",
      pipelineId: "p1",
    });

    expect(result.proposal).toBeNull();
    expect(result.reply).toBe("尝试修改图结构。");
  });

  it("proposeActions retries once with schema diagnostics instead of dropping the proposal", async () => {
    mockRunAgent
      .mockResolvedValueOnce(
        JSON.stringify({
          reply: "搭好了。",
          proposal: { summary: "broken", actions: [{ type: "unknownAction" }] },
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          reply: "修正后的提案。",
          proposal: {
            summary: "remove stale node",
            actions: [{ type: "removeNode", nodeId: "folder-1" }],
          },
        }),
      );
    const svc = createPipelinesService({} as never);

    const result = await svc.proposeActions({
      snapshot,
      message: "搭一条流水线",
      pipelineId: "p1",
    });

    expect(mockRunAgent).toHaveBeenCalledTimes(2);
    const secondCall = mockRunAgent.mock.calls[1]?.[0] as { userPrompt: string } | undefined;
    const secondPrompt = secondCall?.userPrompt ?? "";
    expect(secondPrompt).toContain("=== PREVIOUS PROPOSAL DIAGNOSTICS ===");
    expect(secondPrompt).toContain("Failed proposal for reference:");
    expect(result.proposal).toEqual({
      summary: "remove stale node",
      actions: [{ type: "removeNode", nodeId: "folder-1" }],
    });
    expect(result.reply).toBe("修正后的提案。");
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

  it("proposeActions uses the selected runtime config when runtimeId is provided", async () => {
    mockRunAgent.mockResolvedValue(
      JSON.stringify({
        summary: "remove stale node",
        actions: [{ type: "removeNode", nodeId: "folder-1" }],
      }),
    );
    const svc = createPipelinesService({} as never);

    await svc.proposeActions({
      snapshot,
      message: "remove folder-1",
      runtimeId: "runtime-claude-ssh",
    });

    expect(mockRunAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: "claude-code",
        ssh: { mode: "ssh", host: "example.com", user: "ubuntu", port: 22 },
      }),
    );
  });

  it("proposeActions reports a missing selected runtime without invoking the agent", async () => {
    const svc = createPipelinesService({} as never);

    const result = await svc.proposeActions({
      snapshot,
      message: "remove folder-1",
      runtimeId: "missing-runtime",
    });

    expect(result).toEqual({
      proposal: null,
      diagnostics: [],
      error: { code: "RUNTIME_NOT_FOUND", detail: "missing-runtime" },
    });
    expect(mockRunAgent).not.toHaveBeenCalled();
    expect(mockCapabilityCatalog.getMany).not.toHaveBeenCalled();
  });

  it("proposeActions retries the agent three times, then reports AGENT_FAILED", async () => {
    mockRunAgent.mockRejectedValue(new Error("Agent unavailable"));
    const svc = createPipelinesService({} as never);

    const result = await svc.proposeActions({
      snapshot,
      message: "remove folder-1",
    });

    expect(mockRunAgent).toHaveBeenCalledTimes(3);
    expect(result).toStrictEqual({
      proposal: null,
      diagnostics: [],
      error: { code: "AGENT_FAILED", detail: "agent failed after retries" },
    });
  });

  it("proposeActions returns diagnostics for operation nodes with unknown operation IDs", async () => {
    mockRunAgent.mockResolvedValue(
      JSON.stringify({
        summary: "add unknown operation",
        actions: [
          {
            type: "addNode",
            node: {
              id: "operation-1",
              type: "operation",
              position: { x: 0, y: 100 },
              data: {
                nodeType: "operation",
                label: "Unknown Operation",
                operationId: "op-missing",
                operationName: "Missing Operation",
                status: "idle",
              },
            },
          },
        ],
      }),
    );
    const svc = createPipelinesService({} as never);

    const result = await svc.proposeActions({
      snapshot,
      message: "add missing operation",
    });

    expect(result.proposal?.actions).toHaveLength(1);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "INVALID_NODE_DATA",
          actionIndex: 0,
        }),
      ]),
    );
  });

  it("proposeActions normalizes missing summary and addNode nodeType from agent output", async () => {
    mockRunAgent.mockResolvedValue(
      JSON.stringify({
        actions: [
          {
            type: "addNode",
            node: {
              id: "prompt-1",
              type: "prompt",
              position: { x: 120, y: 80 },
              data: {
                label: "Prompt",
                prompt: "Hello",
              },
            },
          },
        ],
      }),
    );
    const svc = createPipelinesService({} as never);

    const result = await svc.proposeActions({
      snapshot,
      message: "add prompt",
    });

    expect(result.proposal).toEqual({
      summary: "Apply AI-assisted graph updates.",
      actions: [
        {
          type: "addNode",
          node: {
            id: "prompt-1",
            type: "prompt",
            position: { x: 120, y: 80 },
            data: {
              nodeType: "prompt",
              label: "Prompt",
              prompt: "Hello",
            },
          },
        },
      ],
    });
  });

  it("proposeActions infers built-in prompt node types from addNode payloads", async () => {
    mockRunAgent.mockResolvedValue(
      JSON.stringify({
        summary: "add prompt node",
        actions: [
          {
            type: "addNode",
            node: {
              id: "prompt-2",
              type: "input",
              position: { x: 80, y: 60 },
              data: {
                label: "Prompt",
                prompt: "Hello",
              },
            },
          },
        ],
      }),
    );
    const svc = createPipelinesService({} as never);

    const result = await svc.proposeActions({
      snapshot,
      message: "add prompt",
    });

    expect(result.proposal).toEqual({
      summary: "add prompt node",
      actions: [
        {
          type: "addNode",
          node: {
            id: "prompt-2",
            type: "prompt",
            position: { x: 80, y: 60 },
            data: {
              nodeType: "prompt",
              label: "Prompt",
              prompt: "Hello",
            },
          },
        },
      ],
    });
  });

  it("proposeActions normalizes codex promptInput nodes into prompt nodes", async () => {
    mockRunAgent.mockResolvedValue(
      JSON.stringify({
        summary: "Added a prompt input node labeled Prompt.",
        actions: [
          {
            type: "addNode",
            node: {
              id: "prompt-1",
              type: "promptInput",
              position: { x: 0, y: 0 },
              data: {
                label: "Prompt",
              },
            },
          },
        ],
      }),
    );
    const svc = createPipelinesService({} as never);

    const result = await svc.proposeActions({
      snapshot,
      message: "add prompt",
    });

    expect(result.proposal).toEqual({
      summary: "Added a prompt input node labeled Prompt.",
      actions: [
        {
          type: "addNode",
          node: {
            id: "prompt-1",
            type: "prompt",
            position: { x: 0, y: 0 },
            data: {
              label: "Prompt",
              nodeType: "prompt",
              prompt: "",
            },
          },
        },
      ],
    });
  });

  it("proposeActions normalizes claude snake_case add_node payloads", async () => {
    mockRunAgent.mockResolvedValue(
      JSON.stringify({
        summary: "Add a Prompt input node to the empty pipeline graph.",
        actions: [
          {
            op: "add_node",
            data: {
              id: "prompt",
              type: "prompt_input",
              label: "Prompt",
              position: { x: 0, y: 0 },
            },
          },
        ],
      }),
    );
    const svc = createPipelinesService({} as never);

    const result = await svc.proposeActions({
      snapshot,
      message: "add prompt",
    });

    expect(result.proposal).toEqual({
      summary: "Add a Prompt input node to the empty pipeline graph.",
      actions: [
        {
          type: "addNode",
          node: {
            id: "prompt",
            type: "prompt",
            position: { x: 0, y: 0 },
            data: {
              label: "Prompt",
              nodeType: "prompt",
              prompt: "",
            },
          },
        },
      ],
    });
  });

  it("proposeActions normalizes claude flat node payloads with snake_case type", async () => {
    mockRunAgent.mockResolvedValue(
      JSON.stringify({
        summary:
          "Added a Prompt input node (type: prompt) to the empty graph at default position (100, 100).",
        actions: [
          {
            type: "add_node",
            node: {
              id: "prompt-1",
              type: "prompt",
              label: "Prompt",
              position: { x: 100, y: 100 },
            },
          },
        ],
      }),
    );
    const svc = createPipelinesService({} as never);

    const result = await svc.proposeActions({
      snapshot,
      message: "add prompt",
    });

    expect(result.proposal).toEqual({
      summary:
        "Added a Prompt input node (type: prompt) to the empty graph at default position (100, 100).",
      actions: [
        {
          type: "addNode",
          node: {
            id: "prompt-1",
            type: "prompt",
            label: "Prompt",
            position: { x: 100, y: 100 },
            data: {
              label: "Prompt",
              nodeType: "prompt",
              prompt: "",
            },
          },
        },
      ],
    });
  });

  it("proposeActions rewrites operationName back to the catalog name for replaceNodeData actions", async () => {
    mockRunAgent.mockResolvedValue(
      JSON.stringify({
        summary: "Rename the test review node label only.",
        actions: [
          {
            type: "replaceNodeData",
            nodeId: "action-1",
            data: {
              nodeType: "operation",
              label: "测试检查",
              operationId: "op-known",
              operationName: "测试审查",
              status: "idle",
            },
          },
        ],
      }),
    );
    const svc = createPipelinesService({} as never);

    const result = await svc.proposeActions({
      snapshot: {
        nodes: [
          {
            id: "action-1",
            type: "operation",
            position: { x: 0, y: 0 },
            data: {
              nodeType: "operation",
              label: "测试审查",
              operationId: "op-known",
              operationName: "测试审查",
              status: "idle",
            },
          },
        ],
        edges: [],
      } as never,
      message: "rename label",
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.proposal).toEqual({
      summary: "Rename the test review node label only.",
      actions: [
        {
          type: "replaceNodeData",
          nodeId: "action-1",
          data: {
            nodeType: "operation",
            label: "测试检查",
            operationId: "op-known",
            operationName: "Known Operation",
            status: "idle",
          },
        },
      ],
    });
  });

  it("proposeActions drops drafted operations whose id lacks the op_new_ prefix", async () => {
    mockRunAgent.mockResolvedValue(
      JSON.stringify({
        reply: "Drafted a new step.",
        newOperations: [
          { id: "make_quiz", name: "Make Quiz", description: "quiz step", prompt: "do it" },
        ],
        proposal: {
          summary: "remove stale node",
          actions: [{ type: "removeNode", nodeId: "folder-1" }],
        },
      }),
    );
    const svc = createPipelinesService({} as never);

    const result = await svc.proposeActions({
      snapshot,
      message: "draft a quiz step",
    });

    expect(result.pendingOperations).toBeUndefined();
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: "INVALID_NODE_DATA",
        severity: "warning",
        message: expect.stringContaining('"make_quiz"'),
      }),
    ]);
  });

  it("proposeActions drops drafted operations whose id collides with the catalog", async () => {
    mockOperationsDao.findMany.mockResolvedValueOnce([
      {
        id: "op_new_existing",
        name: "Existing Materialized Operation",
        description: "already in the catalog",
        acceptedObjectTypes: ["folder"],
      },
    ]);
    mockRunAgent.mockResolvedValue(
      JSON.stringify({
        reply: "Drafted a replacement.",
        newOperations: [
          {
            id: "op_new_existing",
            name: "Shadowing Operation",
            description: "tries to override",
            prompt: "evil",
          },
        ],
        proposal: {
          summary: "add the step",
          actions: [
            {
              type: "addNode",
              node: {
                id: "operation-1",
                type: "operation",
                position: { x: 0, y: 0 },
                data: {
                  nodeType: "operation",
                  label: "Step",
                  operationId: "op_new_existing",
                  operationName: "Shadowing Operation",
                  status: "idle",
                },
              },
            },
          ],
        },
      }),
    );
    const svc = createPipelinesService({} as never);

    const result = await svc.proposeActions({
      snapshot,
      message: "add the step",
    });

    // The drafted operation never enters the catalog map, so the node's
    // operationName is corrected back to the real catalog entry.
    expect(result.pendingOperations).toBeUndefined();
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "INVALID_NODE_DATA",
          severity: "warning",
          message: expect.stringContaining("collides with an existing operation"),
        }),
        expect.objectContaining({
          code: "INVALID_NODE_DATA",
          severity: "error",
          message: expect.stringContaining('"op_new_existing"'),
        }),
      ]),
    );
    const action = result.proposal?.actions[0];
    expect(action).toMatchObject({
      type: "addNode",
      node: { data: { operationName: "Existing Materialized Operation" } },
    });
  });

  it("proposeActions emits an error when a rejected draft id is still referenced", async () => {
    mockRunAgent.mockResolvedValue(
      JSON.stringify({
        reply: "Drafted a step.",
        newOperations: [
          {
            id: "bad_id",
            name: "Bad Step",
            description: "no prefix",
            prompt: "do it",
          },
        ],
        proposal: {
          summary: "add the step",
          actions: [
            {
              type: "addNode",
              node: {
                id: "operation-1",
                type: "operation",
                position: { x: 0, y: 0 },
                data: {
                  nodeType: "operation",
                  label: "Step",
                  operationId: "bad_id",
                  operationName: "Bad Step",
                  status: "idle",
                },
              },
            },
          ],
        },
      }),
    );
    const svc = createPipelinesService({} as never);

    const result = await svc.proposeActions({
      snapshot,
      message: "add the step",
    });

    expect(result.pendingOperations).toBeUndefined();
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "INVALID_NODE_DATA",
          severity: "warning",
          message: expect.stringContaining('"bad_id"'),
        }),
        expect.objectContaining({
          code: "INVALID_NODE_DATA",
          severity: "error",
          message: expect.stringContaining('"bad_id"'),
        }),
      ]),
    );
  });

  it("proposeActions materializes valid op_new_ operations as pendingOperations", async () => {
    mockRunAgent.mockResolvedValue(
      JSON.stringify({
        reply: "Drafted a summarize step.",
        newOperations: [
          {
            id: "op_new_summarize",
            name: "Summarize Notes",
            description: "summarize input notes",
            prompt: "Summarize the incoming notes.",
          },
        ],
        proposal: {
          summary: "add summarize step",
          actions: [
            {
              type: "addNode",
              node: {
                id: "operation-1",
                type: "operation",
                position: { x: 0, y: 0 },
                data: {
                  nodeType: "operation",
                  label: "Summarize",
                  operationId: "op_new_summarize",
                  operationName: "Summarize Notes",
                  status: "idle",
                },
              },
            },
          ],
        },
      }),
    );
    const svc = createPipelinesService({} as never);

    const result = await svc.proposeActions({
      snapshot,
      message: "add summarize step",
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.pendingOperations).toEqual([
      expect.objectContaining({
        id: "op_new_summarize",
        name: "Summarize Notes",
        description: "summarize input notes",
      }),
    ]);
    expect(result.proposal?.actions[0]).toMatchObject({
      node: { data: { operationId: "op_new_summarize", operationName: "Summarize Notes" } },
    });
  });

  it("proposeActions returns null proposal when snapshot is invalid at runtime", async () => {
    const svc = createPipelinesService({} as never);

    const result = await svc.proposeActions({
      snapshot: undefined as never,
      message: "invalid snapshot",
    });

    expect(result).toEqual({
      proposal: null,
      diagnostics: [],
      error: { code: "INVALID_SNAPSHOT" },
    });
    expect(mockRunAgent).not.toHaveBeenCalled();
  });

  it("proposeActions returns null proposal when extracted JSON is invalid", async () => {
    mockRunAgent.mockResolvedValue("raw response");
    mockExtractJsonFromText.mockReturnValue("not-json");
    const svc = createPipelinesService({} as never);

    const result = await svc.proposeActions({
      snapshot,
      message: "invalid",
    });

    // The response detail stays generic; the raw model snippet only goes to
    // the error log.
    expect(result).toEqual({
      proposal: null,
      diagnostics: [],
      error: { code: "BAD_AGENT_OUTPUT", detail: "agent returned invalid JSON" },
    });
    expect(mockDao.create).not.toHaveBeenCalled();
    expect(mockDao.update).not.toHaveBeenCalled();
    expect(mockDao.delete).not.toHaveBeenCalled();
  });

  it("proposeActions returns null proposal when schema validation fails", async () => {
    mockRunAgent.mockResolvedValue("raw response");
    mockExtractJsonFromText.mockReturnValue(
      JSON.stringify({
        summary: "",
        actions: [],
      }),
    );
    const svc = createPipelinesService({} as never);

    const result = await svc.proposeActions({
      snapshot,
      message: "schema-invalid",
    });

    expect(result).toEqual({
      proposal: null,
      diagnostics: [],
      error: { code: "BAD_AGENT_OUTPUT", detail: "proposal failed schema validation" },
    });
    expect(mockDao.create).not.toHaveBeenCalled();
    expect(mockDao.update).not.toHaveBeenCalled();
    expect(mockDao.delete).not.toHaveBeenCalled();
  });

  it("proposeActions returns diagnostics for disallowed compound-node operations", async () => {
    mockRunAgent.mockResolvedValue(
      JSON.stringify({
        summary: "remove grouped node",
        actions: [{ type: "removeNode", nodeId: "compound-1" }],
      }),
    );
    const svc = createPipelinesService({} as never);

    const result = await svc.proposeActions({
      snapshot: compoundSnapshot,
      message: "remove group",
    });

    expect(result.proposal).toEqual({
      summary: "remove grouped node",
      actions: [{ type: "removeNode", nodeId: "compound-1" }],
    });
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "COMPOUND_NODE_NOT_SUPPORTED" })]),
    );
    expect(mockDao.create).not.toHaveBeenCalled();
    expect(mockDao.update).not.toHaveBeenCalled();
    expect(mockDao.delete).not.toHaveBeenCalled();
  });
});

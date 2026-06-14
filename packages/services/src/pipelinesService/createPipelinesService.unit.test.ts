import { beforeEach, describe, it, expect, vi } from "vitest";

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
  findMany: vi.fn().mockResolvedValue([
    {
      id: "op-known",
      name: "Known Operation",
      description: "Known operation description",
      acceptedObjectTypes: ["folder"],
    },
  ]),
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
const mockConversationMessagesDao = {
  getByPipelineId: vi.fn().mockResolvedValue([]),
};
const mockRunAgent = vi.fn();
const mockExtractJsonFromText = vi.fn((raw: string) => raw);

vi.mock("@repo/models", () => ({
  createAgentRuntimesDao: () => mockAgentRuntimesDao,
  createConversationMessagesDao: () => mockConversationMessagesDao,
  createPipelinesDao: () => mockDao,
  createDistillationsDao: () => ({}),
  createJobsDao: () => ({}),
  createPipelineRunsDao: () => ({
    findByJobId: vi.fn(),
    deleteByPipelineId: vi.fn().mockResolvedValue(undefined),
  }),
  createJobTracesDao: () => ({}),
  createAgentRawExportsDao: () => ({}),
  createAgentSpansDao: () => ({}),
  createOperationsDao: () => mockOperationsDao,
  createSettingsDao: () => mockSettingsDao,
}));
vi.mock("@repo/agent", () => ({
  extractJsonFromText: (raw: string) => mockExtractJsonFromText(raw),
}));
vi.mock("../pipelineRunnerService/agentRunner/agentRunner", () => ({
  runAgent: (opts: unknown) => mockRunAgent(opts),
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
    mockAgentRuntimesDao.findMany.mockClear();
    mockConversationMessagesDao.getByPipelineId.mockClear();
    mockConversationMessagesDao.getByPipelineId.mockResolvedValue([]);
    mockRunAgent.mockReset();
    mockExtractJsonFromText.mockReset();
    mockExtractJsonFromText.mockImplementation((raw: string) => raw);
  };

  beforeEach(() => {
    resetCommonMocks();
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
    await svc.create(data);
    expect(mockDao.create).toHaveBeenCalledWith(data);
  });

  it("update delegates to dao.update", async () => {
    const svc = createPipelinesService({} as never);
    await svc.update("p1", { name: "updated" } as never);
    expect(mockDao.update).toHaveBeenCalledWith("p1", { name: "updated" });
  });

  it("delete delegates to dao.delete", async () => {
    const svc = createPipelinesService({} as never);
    await svc.delete("p1");
    expect(mockDao.delete).toHaveBeenCalledWith("p1");
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
    const secondPrompt = (mockRunAgent.mock.calls[1]?.[0] as { userPrompt: string }).userPrompt;
    expect(secondPrompt).toContain("=== PREVIOUS PROPOSAL DIAGNOSTICS ===");
    expect(secondPrompt).toContain("Failed proposal for reference:");
    expect(result.proposal).toEqual({
      summary: "remove stale node",
      actions: [{ type: "removeNode", nodeId: "folder-1" }],
    });
    expect(result.reply).toBe("修正后的提案。");
  });

  it("proposeActions injects conversation history into the user prompt", async () => {
    mockConversationMessagesDao.getByPipelineId.mockResolvedValue([
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
    expect(mockConversationMessagesDao.getByPipelineId).toHaveBeenCalledWith("p1");
    expect(callArgs.userPrompt).toContain("=== CONVERSATION HISTORY (oldest first) ===");
    expect(callArgs.userPrompt).toContain("[user]: build a quiz pipeline");
    expect(callArgs.userPrompt).toContain("[assistant] (included a graph proposal): Drafted it.");
    // 当前这条消息已在 USER REQUEST 段，历史中不应重复
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

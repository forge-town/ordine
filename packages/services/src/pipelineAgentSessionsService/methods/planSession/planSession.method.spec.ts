import { beforeEach, describe, expect, it, vi } from "vitest";

import { ok } from "neverthrow";

const mockSessionsDao = {
  create: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
};

const mockMessagesDao = {
  create: vi.fn(),
  findManyBySessionId: vi.fn(),
};

const mockAttachmentsDao = {
  create: vi.fn(),
  findManyBySessionId: vi.fn(),
};

const mockAttachmentsRepository = {
  deleteWithContextArtifacts: vi.fn(),
};

const mockContextArtifactsDao = {
  create: vi.fn(),
  findManyBySessionId: vi.fn(),
};

const mockProposalsDao = {
  create: vi.fn(),
  findById: vi.fn(),
  findLatestBySessionId: vi.fn(),
  findManyBySessionId: vi.fn(),
  update: vi.fn(),
};

const mockSettingsDao = {
  get: vi.fn(),
};

const mockOperationsDao = {
  create: vi.fn(),
  findMany: vi.fn(),
};

const mockAgentRuntimesDao = {
  findMany: vi.fn(),
};

const mockConversationMessagesDao = {
  create: vi.fn(),
};

const mockPipelinesDao = {
  create: vi.fn(),
};
const mockRoutinesDao = {
  create: vi.fn(),
};
const mockPipelinesService = {
  analyzeIntent: vi.fn(),
  create: vi.fn(),
  createPendingOperations: vi.fn(),
  delete: vi.fn(),
  generateStructure: vi.fn(),
  proposeActions: vi.fn(),
  updateOperationExecutors: vi.fn(),
};

const mockRunAgent = vi.fn();
const mockAgentRunsService = {
  cancel: vi.fn(),
  getById: vi.fn(),
  getLatestByOwner: vi.fn(),
  start: vi.fn(),
  wait: vi.fn(),
};
const mockExtractJsonFromText = vi.fn((raw: string) => raw);
const createDeferred = <T>() => {
  const state: { resolve: (value: T | PromiseLike<T>) => void } = {
    resolve: () => undefined,
  };
  const promise = new Promise<T>((resolvePromise) => {
    state.resolve = resolvePromise;
  });

  return { promise, resolve: (value: T) => state.resolve(value) };
};

vi.mock("@repo/models", () => ({
  createAgentRuntimesDao: () => mockAgentRuntimesDao,
  createConversationMessagesDao: () => mockConversationMessagesDao,
  createOperationsDao: () => mockOperationsDao,
  createPipelinesDao: () => mockPipelinesDao,
  createPipelineAgentSessionsDao: (executor: { sessionsDao?: typeof mockSessionsDao }) =>
    executor?.sessionsDao ?? mockSessionsDao,
  createPipelineAgentMessagesDao: () => mockMessagesDao,
  createPipelineAgentAttachmentsDao: () => mockAttachmentsDao,
  createPipelineAgentAttachmentsRepository: () => mockAttachmentsRepository,
  createPipelineAgentContextArtifactsDao: () => mockContextArtifactsDao,
  createPipelineAgentProposalsDao: (executor: { proposalsDao?: typeof mockProposalsDao }) =>
    executor?.proposalsDao ?? mockProposalsDao,
  createRoutinesDao: () => mockRoutinesDao,
  createSettingsDao: () => mockSettingsDao,
}));

vi.mock("@repo/agent", () => ({
  extractJsonFromText: (raw: string) => mockExtractJsonFromText(raw),
}));

vi.mock("../../../pipelineRunnerService/helpers/agentRunner/agentRunner.helper", () => ({
  runAgent: (opts: unknown) => mockRunAgent(opts),
}));

vi.mock("../../../pipelinesService", () => ({
  createPipelinesService: (executor: { pipelinesService?: typeof mockPipelinesService }) =>
    executor?.pipelinesService ?? mockPipelinesService,
}));

import { createPipelineAgentSessionsService as createPipelineAgentSessionsServiceFactory } from "../..";

const mockDb = {
  transaction: vi.fn(async (callback: (transaction: unknown) => Promise<unknown>) => callback({})),
};
const createPipelineAgentSessionsService = (_db: never) =>
  createPipelineAgentSessionsServiceFactory(mockDb as never);

describe("createPipelineAgentSessionsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.transaction.mockImplementation(async (callback) => callback({}));
    mockAgentRunsService.getLatestByOwner.mockResolvedValue(null);
    mockAgentRunsService.cancel.mockResolvedValue({ id: "run-1", status: "cancelled" });
    mockAgentRunsService.start.mockResolvedValue({ runId: "run-1" });
    mockAgentRunsService.wait.mockReturnValue(new Promise(() => undefined));

    mockSessionsDao.create.mockImplementation(async (data) => ({
      id: data.id ?? "session-1",
      ...data,
      createdAt: new Date("2026-06-03T12:00:00.000Z"),
      updatedAt: new Date("2026-06-03T12:00:00.000Z"),
    }));
    mockMessagesDao.create.mockImplementation(async (data) => ({
      id: data.id ?? "message-1",
      ...data,
      createdAt: new Date("2026-06-03T12:00:01.000Z"),
    }));
    mockConversationMessagesDao.create.mockImplementation(async (data) => ({
      ...data,
      createdAt: data.createdAt ?? new Date("2026-06-03T12:00:05.000Z"),
    }));
    mockAttachmentsDao.create.mockImplementation(async (data) => ({
      id: data.id ?? "attachment-1",
      ...data,
      createdAt: new Date("2026-06-03T12:00:01.250Z"),
      updatedAt: new Date("2026-06-03T12:00:01.250Z"),
    }));
    mockContextArtifactsDao.create.mockImplementation(async (data) => ({
      id: data.id ?? "artifact-1",
      ...data,
      createdAt: new Date("2026-06-03T12:00:01.500Z"),
      updatedAt: new Date("2026-06-03T12:00:01.500Z"),
    }));
    mockProposalsDao.create.mockImplementation(async (data) => ({
      id: data.id ?? "proposal-1",
      ...data,
      createdAt: new Date("2026-06-03T12:00:02.000Z"),
      updatedAt: new Date("2026-06-03T12:00:02.000Z"),
    }));
    mockSessionsDao.update.mockImplementation(async (_id, patch) => ({
      id: "session-1",
      ...patch,
      updatedAt: new Date("2026-06-03T12:00:03.000Z"),
    }));
    mockProposalsDao.update.mockImplementation(async (_id, patch) => ({
      id: "proposal-1",
      ...patch,
      updatedAt: new Date("2026-06-03T12:00:04.000Z"),
    }));
    mockSessionsDao.findById.mockResolvedValue({
      id: "session-1",
      entrypoint: "new-pipeline-dialog",
      mode: "generate",
      status: "proposal_ready",
      pipelineId: null,
      snapshot: null,
      latestProposalId: "proposal-1",
      approvedProposalId: null,
      createdPipelineId: null,
      createdAt: new Date("2026-06-03T12:00:00.000Z"),
      updatedAt: new Date("2026-06-03T12:00:03.000Z"),
    });
    mockMessagesDao.findManyBySessionId.mockResolvedValue([
      {
        id: "message-1",
        sessionId: "session-1",
        role: "user",
        kind: "text",
        content: "Build me a review pipeline",
        createdAt: new Date("2026-06-03T12:00:01.000Z"),
      },
    ]);
    mockAttachmentsDao.findManyBySessionId.mockResolvedValue([]);
    mockContextArtifactsDao.findManyBySessionId.mockResolvedValue([]);
    mockSettingsDao.get.mockResolvedValue({
      defaultAgentRuntime: "codex",
      defaultApiKey: "test-key",
      defaultModel: "gpt-5.4-mini",
    });
    mockOperationsDao.findMany.mockResolvedValue([
      {
        id: "review-code",
        name: "Review Code",
        description: "Find correctness issues before merging.",
        acceptedObjectTypes: ["folder"],
      },
    ]);
    mockAgentRuntimesDao.findMany.mockResolvedValue([
      {
        id: "runtime-codex",
        name: "Codex Local",
        type: "codex",
        connection: { mode: "local" },
      },
    ]);
    mockPipelinesDao.create.mockImplementation(async (data) => ({
      id: data.id ?? "pipeline-1",
      ...data,
      createdAt: data.createdAt ?? new Date("2026-06-03T12:00:05.000Z"),
      updatedAt: data.updatedAt ?? new Date("2026-06-03T12:00:05.000Z"),
    }));
    mockRoutinesDao.create.mockImplementation(async (data) => ({
      ...data,
      createdAt: new Date("2026-06-03T12:00:05.000Z"),
      updatedAt: new Date("2026-06-03T12:00:05.000Z"),
    }));
    mockPipelinesService.analyzeIntent.mockResolvedValue({
      matchedOperations: [
        { operationId: "review-code", operationName: "Review Code", reason: "Matches code review" },
      ],
      unmatchedSteps: [],
    });
    mockPipelinesService.generateStructure.mockResolvedValue({
      nodes: [],
      edges: [],
    });
    mockPipelinesService.createPendingOperations.mockResolvedValue(ok(undefined));
    mockPipelinesService.updateOperationExecutors.mockResolvedValue(ok(undefined));
    mockPipelinesService.delete.mockResolvedValue(undefined);
    mockPipelinesService.create.mockImplementation(async (data) =>
      ok({
        id: data.id ?? "pipeline-1",
        ...data,
        createdAt: new Date("2026-06-03T12:00:05.000Z"),
        updatedAt: new Date("2026-06-03T12:00:05.000Z"),
      }),
    );
    mockPipelinesService.proposeActions.mockResolvedValue({
      proposal: {
        summary: "Delete invalid middle nodes",
        actions: [
          {
            type: "removeNode",
            nodeId: "node-1",
          },
        ],
      },
      diagnostics: [],
    });
    mockProposalsDao.findManyBySessionId.mockResolvedValue([
      {
        id: "proposal-1",
        sessionId: "session-1",
        mode: "generate",
        status: "proposal_ready",
        proposal: {
          mode: "generate",
          assistantReply:
            "我会把仓库代码审查拆成输入、审查和报告三个阶段。\n\n审查步骤消费文件夹内容，完成后再生成 Markdown 报告。你可以先查看拟议操作，确认后再应用。",
          purpose: "Review repository code",
          inputs: ["folder"],
          outputs: ["markdown report"],
          majorOperations: ["review-code"],
          executionFlow: ["folder -> review-code -> output"],
          assumptions: [],
          openQuestions: [],
          readiness: "ready_for_generation",
        },
        createdAt: new Date("2026-06-03T12:00:02.000Z"),
        updatedAt: new Date("2026-06-03T12:00:02.000Z"),
        approvedAt: null,
      },
    ]);
    mockProposalsDao.findById.mockResolvedValue({
      id: "proposal-1",
      sessionId: "session-1",
      mode: "generate",
      status: "proposal_ready",
      proposal: {
        mode: "generate",
        purpose: "Review repository code",
        inputs: ["folder"],
        outputs: ["markdown report"],
        majorOperations: ["review-code"],
        executionFlow: ["folder -> review-code -> output"],
        assumptions: [],
        openQuestions: [],
        readiness: "ready_for_generation",
      },
      createdAt: new Date("2026-06-03T12:00:02.000Z"),
      updatedAt: new Date("2026-06-03T12:00:02.000Z"),
      approvedAt: null,
    });
    mockProposalsDao.findLatestBySessionId.mockResolvedValue({
      id: "proposal-1",
      sessionId: "session-1",
      mode: "generate",
      status: "proposal_ready",
      proposal: {
        mode: "generate",
        purpose: "Review repository code",
        inputs: ["folder"],
        outputs: ["markdown report"],
        majorOperations: ["review-code"],
        executionFlow: ["folder -> review-code -> output"],
        assumptions: [],
        openQuestions: [],
        readiness: "ready_for_generation",
      },
      createdAt: new Date("2026-06-03T12:00:02.000Z"),
      updatedAt: new Date("2026-06-03T12:00:02.000Z"),
      approvedAt: null,
    });
    mockRunAgent.mockReset();
    mockExtractJsonFromText.mockReset();
    mockExtractJsonFromText.mockImplementation((raw: string) => raw);
  });
  it("fails planning with a stable error before invoking an unconfigured runtime", async () => {
    mockAgentRuntimesDao.findMany.mockResolvedValueOnce([]);
    const service = createPipelineAgentSessionsService({} as never);

    await expect(service.planSession("session-1")).rejects.toMatchObject({
      code: "PIPELINE_AGENT_RUNTIME_NOT_FOUND",
    });

    expect(mockRunAgent).not.toHaveBeenCalled();
    expect(mockSessionsDao.update).toHaveBeenLastCalledWith("session-1", {
      status: "failed",
    });
  });
  it("uses a deterministic local runtime id when the server database has no matching row", async () => {
    mockAgentRuntimesDao.findMany.mockResolvedValueOnce([]);
    mockRunAgent.mockResolvedValueOnce(
      JSON.stringify({ type: "question", question: "Which output format do you want?" }),
    );

    const result = await createPipelineAgentSessionsService({} as never).planSession("session-1", {
      runtimeId: "local-codex",
    });

    expect(result).toEqual({
      type: "question",
      question: "Which output format do you want?",
    });
    expect(mockRunAgent).toHaveBeenCalledWith(expect.objectContaining({ agent: "codex" }));
  });
  it("saves a generate proposal when planning returns a ready plan", async () => {
    mockSessionsDao.findById.mockResolvedValueOnce({
      id: "session-1",
      entrypoint: "new-pipeline-dialog",
      mode: "generate",
      status: "draft",
      pipelineId: null,
      snapshot: null,
      latestProposalId: null,
      approvedProposalId: null,
      createdPipelineId: null,
      createdAt: new Date("2026-06-03T12:00:00.000Z"),
      updatedAt: new Date("2026-06-03T12:00:00.000Z"),
    });
    mockMessagesDao.findManyBySessionId.mockResolvedValueOnce([
      {
        id: "message-1",
        sessionId: "session-1",
        role: "user",
        kind: "text",
        content: "Build me a code review pipeline",
        createdAt: new Date("2026-06-03T12:00:01.000Z"),
      },
    ]);
    mockRunAgent.mockResolvedValue(
      JSON.stringify({
        type: "proposal",
        proposal: {
          mode: "generate",
          assistantReply:
            "我会把仓库代码审查拆成输入、审查和报告三个阶段。\n\n审查步骤消费文件夹内容，完成后再生成 Markdown 报告。你可以先查看拟议操作，确认后再应用。",
          purpose: "Review repository code",
          inputs: ["folder"],
          outputs: ["markdown report"],
          majorOperations: ["review-code"],
          executionFlow: ["folder -> review-code -> output"],
          assumptions: [],
          openQuestions: [],
          readiness: "ready_for_generation",
        },
      }),
    );

    const service = createPipelineAgentSessionsService({} as never);
    const result = await service.planSession("session-1");

    expect(result).toEqual(
      expect.objectContaining({
        type: "proposal",
        proposal: expect.objectContaining({
          mode: "generate",
          purpose: "Review repository code",
        }),
      }),
    );
    expect(mockProposalsDao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "session-1",
        mode: "generate",
      }),
    );
    expect(mockMessagesDao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("拆成输入、审查和报告三个阶段"),
        kind: "proposal_summary",
        role: "assistant",
      }),
    );
    expect(mockSessionsDao.update).toHaveBeenLastCalledWith(
      "session-1",
      expect.objectContaining({ status: "proposal_ready" }),
    );
  });
  it("keeps an explicitly requested schedule as proposal metadata", async () => {
    mockRunAgent.mockResolvedValue(
      JSON.stringify({
        type: "proposal",
        proposal: {
          mode: "generate",
          purpose: "Weekday repository review",
          inputs: ["repository"],
          outputs: ["report"],
          majorOperations: ["review-code"],
          executionFlow: ["repository -> review-code -> report"],
          assumptions: [],
          openQuestions: [],
          schedule: { name: "Weekday review", cronExpression: "0 9 * * 1-5", enabled: true },
          readiness: "ready_for_generation",
        },
      }),
    );

    const result = await createPipelineAgentSessionsService({} as never).planSession("session-1");

    expect(result).toMatchObject({
      type: "proposal",
      proposal: {
        schedule: { cronExpression: "0 9 * * 1-5", enabled: true },
      },
    });
    const plannerCall = mockRunAgent.mock.calls[0]![0] as { userPrompt: string };
    expect(plannerCall.userPrompt).toContain("A schedule is Pipeline metadata");
  });
  it("marks the session failed when planning returns invalid JSON", async () => {
    mockSessionsDao.findById.mockResolvedValueOnce({
      id: "session-1",
      entrypoint: "new-pipeline-dialog",
      mode: "generate",
      status: "draft",
      pipelineId: null,
      snapshot: null,
      latestProposalId: null,
      approvedProposalId: null,
      createdPipelineId: null,
      createdAt: new Date("2026-06-03T12:00:00.000Z"),
      updatedAt: new Date("2026-06-03T12:00:00.000Z"),
    });
    mockRunAgent.mockResolvedValueOnce("not json");

    const service = createPipelineAgentSessionsService({} as never);
    await expect(service.planSession("session-1")).rejects.toThrow();

    expect(mockSessionsDao.update).toHaveBeenLastCalledWith(
      "session-1",
      expect.objectContaining({
        status: "failed",
      }),
    );
  });
  it("bridges edit planning into executable canvas actions", async () => {
    mockSessionsDao.findById.mockResolvedValueOnce({
      id: "session-edit",
      entrypoint: "canvas-agent-panel",
      mode: "edit",
      status: "draft",
      pipelineId: "pipe-1",
      snapshot: { nodes: [], edges: [] },
      latestProposalId: null,
      approvedProposalId: null,
      createdPipelineId: null,
      createdAt: new Date("2026-06-03T12:00:00.000Z"),
      updatedAt: new Date("2026-06-03T12:00:00.000Z"),
    });
    mockRunAgent.mockResolvedValueOnce(
      JSON.stringify({
        type: "proposal",
        proposal: {
          mode: "edit",
          summary: "Delete invalid middle nodes",
          targetGraphIntent: "Simplify the graph to input and output only",
          majorChanges: ["Remove invalid middle nodes"],
          assumptions: [],
          openQuestions: [],
          readiness: "ready_for_generation",
          actions: ["placeholder"],
          diagnosticsPreview: ["placeholder"],
        },
      }),
    );

    const service = createPipelineAgentSessionsService({} as never);
    const result = await service.planSession("session-edit", {
      runtimeId: "runtime-codex",
    });

    expect(mockPipelinesService.proposeActions).toHaveBeenCalledWith({
      snapshot: { nodes: [], edges: [] },
      message: expect.stringContaining("Delete invalid middle nodes"),
      pipelineId: "pipe-1",
      runtimeId: "runtime-codex",
    });
    expect(result).toEqual(
      expect.objectContaining({
        type: "proposal",
        proposal: expect.objectContaining({
          mode: "edit",
          summary: "Delete invalid middle nodes",
          actions: [{ type: "removeNode", nodeId: "node-1" }],
        }),
      }),
    );
  });
  it("returns an edit question without calling proposeActions when planning needs user input", async () => {
    mockSessionsDao.findById.mockResolvedValueOnce({
      id: "session-edit",
      entrypoint: "canvas-agent-panel",
      mode: "edit",
      status: "draft",
      pipelineId: "pipe-1",
      snapshot: { nodes: [], edges: [] },
      latestProposalId: null,
      approvedProposalId: null,
      createdPipelineId: null,
      createdAt: new Date("2026-06-03T12:00:00.000Z"),
      updatedAt: new Date("2026-06-03T12:00:00.000Z"),
    });
    mockRunAgent.mockResolvedValueOnce(
      JSON.stringify({
        type: "proposal",
        proposal: {
          mode: "edit",
          summary: "Update the exam pipeline",
          targetGraphIntent: "Clarify the required exam format",
          majorChanges: ["Update the output step"],
          assumptions: [],
          openQuestions: ["Which grade level should this target?", "Which output format?"],
          readiness: "needs_user_answer",
        },
      }),
    );

    const result = await createPipelineAgentSessionsService({} as never).planSession(
      "session-edit",
      { runtimeId: "runtime-codex" },
    );

    expect(result).toEqual({
      type: "question",
      question: "Which grade level should this target?\nWhich output format?",
    });
    expect(mockPipelinesService.proposeActions).not.toHaveBeenCalled();
    expect(mockProposalsDao.create).not.toHaveBeenCalled();
    expect(mockMessagesDao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "session-edit",
        kind: "question",
        content: expect.stringContaining("Which grade level should this target?"),
      }),
    );
    expect(mockSessionsDao.update).toHaveBeenLastCalledWith("session-edit", {
      status: "awaiting_user",
    });
  });
  it("stores pendingOperations returned by proposeActions in the edit proposal", async () => {
    mockSessionsDao.findById.mockResolvedValueOnce({
      id: "session-edit",
      entrypoint: "canvas-agent-panel",
      mode: "edit",
      status: "draft",
      pipelineId: "pipe-1",
      snapshot: { nodes: [], edges: [] },
      latestProposalId: null,
      approvedProposalId: null,
      createdPipelineId: null,
      createdAt: new Date("2026-06-03T12:00:00.000Z"),
      updatedAt: new Date("2026-06-03T12:00:00.000Z"),
    });
    mockRunAgent.mockResolvedValueOnce(
      JSON.stringify({
        type: "proposal",
        proposal: {
          mode: "edit",
          summary: "Add summarize step",
          targetGraphIntent: "Add summarize step",
          majorChanges: ["Add summarize step"],
          assumptions: [],
          openQuestions: [],
          readiness: "ready_for_generation",
        },
      }),
    );
    mockPipelinesService.proposeActions.mockResolvedValueOnce({
      proposal: {
        summary: "Add summarize step",
        actions: [],
      },
      diagnostics: [],
      pendingOperations: [
        {
          id: "op_new_summarize",
          name: "Summarize Notes",
          description: "summarize input notes",
          config: { executor: { type: "agent" } },
          acceptedObjectTypes: ["file", "folder"],
        },
      ],
    });

    const service = createPipelineAgentSessionsService({} as never);
    const result = await service.planSession("session-edit");

    expect(result).toEqual(
      expect.objectContaining({
        type: "proposal",
        proposal: expect.objectContaining({
          mode: "edit",
          pendingOperations: [
            expect.objectContaining({
              id: "op_new_summarize",
              name: "Summarize Notes",
            }),
          ],
        }),
      }),
    );
  });
});

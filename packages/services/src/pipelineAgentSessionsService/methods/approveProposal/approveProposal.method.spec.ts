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
  it("approves the selected proposal and marks the session approved", async () => {
    const service = createPipelineAgentSessionsService({} as never);

    await service.approveProposal("session-1", "proposal-1");

    expect(mockProposalsDao.update).toHaveBeenCalledWith(
      "proposal-1",
      expect.objectContaining({
        status: "approved",
      }),
    );
    expect(mockSessionsDao.update).toHaveBeenCalledWith(
      "session-1",
      expect.objectContaining({
        status: "approved",
        approvedProposalId: "proposal-1",
      }),
    );
    expect(mockDb.transaction).toHaveBeenCalledOnce();
  });
  it("materializes pendingOperations when approving an edit-mode proposal", async () => {
    mockSessionsDao.findById.mockResolvedValueOnce({
      id: "session-1",
      entrypoint: "canvas-agent-panel",
      mode: "edit",
      status: "proposal_ready",
      pipelineId: "pipe-1",
      snapshot: { nodes: [], edges: [] },
      latestProposalId: "proposal-edit-1",
      approvedProposalId: null,
      createdPipelineId: null,
      createdAt: new Date("2026-06-03T12:00:00.000Z"),
      updatedAt: new Date("2026-06-03T12:00:00.000Z"),
    });
    mockProposalsDao.findById.mockResolvedValueOnce({
      id: "proposal-edit-1",
      sessionId: "session-1",
      mode: "edit",
      status: "proposal_ready",
      proposal: {
        mode: "edit",
        summary: "Add summarize step",
        targetGraphIntent: "Add summarize step",
        majorChanges: [],
        assumptions: [],
        openQuestions: [],
        actions: [],
        diagnosticsPreview: [],
        readiness: "ready_for_generation",
        pendingOperations: [
          {
            id: "op_new_summarize",
            name: "Summarize Notes",
            description: "summarize input notes",
            config: { executor: { type: "agent" } },
            acceptedObjectTypes: ["file", "folder"],
          },
        ],
      },
      createdAt: new Date("2026-06-03T12:00:02.000Z"),
      updatedAt: new Date("2026-06-03T12:00:02.000Z"),
      approvedAt: null,
    });
    const service = createPipelineAgentSessionsService({} as never);

    await service.approveProposal("session-1", "proposal-edit-1");

    expect(mockPipelinesService.createPendingOperations).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "op_new_summarize",
        name: "Summarize Notes",
        acceptedObjectTypes: ["file", "folder"],
      }),
    ]);
    expect(mockProposalsDao.update).toHaveBeenCalledWith(
      "proposal-edit-1",
      expect.objectContaining({ status: "approved" }),
    );
    expect(mockSessionsDao.update).toHaveBeenCalledWith(
      "session-1",
      expect.objectContaining({ status: "approved" }),
    );
  });
  it("rolls back approval state and pending operations when the final session update fails", async () => {
    const committed = {
      operations: [] as string[],
      updatedOperations: [] as string[],
      proposalStatus: "proposal_ready",
      sessionStatus: "proposal_ready",
    };
    const session = {
      id: "session-1",
      mode: "edit",
      status: "proposal_ready",
      snapshot: {
        nodes: [
          {
            id: "existing-node",
            type: "operation",
            position: { x: 0, y: 0 },
            data: {
              nodeType: "operation",
              label: "Existing",
              operationId: "op-existing",
              operationName: "Existing",
              status: "idle",
            },
          },
        ],
        edges: [],
      },
    };
    const proposal = {
      id: "proposal-edit-1",
      sessionId: "session-1",
      mode: "edit",
      status: "proposal_ready",
      proposal: {
        mode: "edit",
        readiness: "ready_for_generation",
        actions: [
          {
            type: "updateOperation",
            operationId: "op-existing",
            executor: {
              type: "script",
              language: "bash",
              command: "echo updated",
              assignmentReason: "This deterministic command needs no Agent capability.",
            },
          },
        ],
        pendingOperations: [
          {
            id: "op-new",
            name: "New operation",
            description: "new",
            config: { executor: { type: "agent" } },
            acceptedObjectTypes: ["file"],
          },
        ],
      },
    };
    mockDb.transaction.mockImplementationOnce(async (callback) => {
      const staged = {
        operations: [...committed.operations],
        updatedOperations: [...committed.updatedOperations],
        proposalStatus: committed.proposalStatus,
        sessionStatus: committed.sessionStatus,
      };
      const value = await callback({
        pipelinesService: {
          ...mockPipelinesService,
          createPendingOperations: vi.fn(async (operations: Array<{ id: string }>) => {
            staged.operations.push(...operations.map((operation) => operation.id));

            return ok(undefined);
          }),
          updateOperationExecutors: vi.fn(async (updates: Array<{ operationId: string }>) => {
            staged.updatedOperations.push(...updates.map((update) => update.operationId));

            return ok(undefined);
          }),
        },
        proposalsDao: {
          ...mockProposalsDao,
          findById: vi.fn().mockResolvedValue(proposal),
          update: vi.fn(async () => {
            staged.proposalStatus = "approved";
          }),
        },
        sessionsDao: {
          ...mockSessionsDao,
          findById: vi.fn().mockResolvedValue(session),
          update: vi.fn().mockRejectedValue(new Error("injected session update failure")),
        },
      });
      Object.assign(committed, staged);

      return value;
    });
    const service = createPipelineAgentSessionsService({} as never);

    await expect(service.approveProposal("session-1", "proposal-edit-1")).rejects.toThrow(
      "injected session update failure",
    );
    expect(committed).toEqual({
      operations: [],
      updatedOperations: [],
      proposalStatus: "proposal_ready",
      sessionStatus: "proposal_ready",
    });
  });
  it("does not call createPendingOperations for proposals without pendingOperations", async () => {
    const service = createPipelineAgentSessionsService({} as never);

    await service.approveProposal("session-1", "proposal-1");

    expect(mockPipelinesService.createPendingOperations).not.toHaveBeenCalled();
  });
  it("updates a shared Operation executor while approving an edit proposal", async () => {
    mockSessionsDao.findById.mockResolvedValueOnce({
      id: "session-1",
      entrypoint: "canvas-agent-panel",
      mode: "edit",
      status: "proposal_ready",
      pipelineId: "pipe-1",
      snapshot: {
        nodes: [
          {
            id: "review-node",
            type: "operation",
            position: { x: 0, y: 0 },
            data: {
              nodeType: "operation",
              label: "Review Code",
              operationId: "review-code",
              operationName: "Review Code",
              status: "idle",
            },
          },
        ],
        edges: [],
      },
      latestProposalId: "proposal-edit-1",
      approvedProposalId: null,
      createdPipelineId: null,
      createdAt: new Date("2026-06-03T12:00:00.000Z"),
      updatedAt: new Date("2026-06-03T12:00:00.000Z"),
    });
    const executor = {
      type: "agent" as const,
      agentMode: "prompt" as const,
      agent: "codex" as const,
      model: "gpt-review",
      prompt: "Review the supplied diff.",
      allowedTools: ["Read"],
      assignmentReason: "Read-only access is sufficient for semantic review.",
    };
    mockProposalsDao.findById.mockResolvedValueOnce({
      id: "proposal-edit-1",
      sessionId: "session-1",
      mode: "edit",
      status: "proposal_ready",
      proposal: {
        mode: "edit",
        summary: "Change the review executor",
        targetGraphIntent: "Use the selected review model",
        majorChanges: [],
        assumptions: [],
        openQuestions: [],
        actions: [{ type: "updateOperation", operationId: "review-code", executor }],
        diagnosticsPreview: [],
        readiness: "ready_for_generation",
        pendingOperations: [],
      },
      createdAt: new Date("2026-06-03T12:00:02.000Z"),
      updatedAt: new Date("2026-06-03T12:00:02.000Z"),
      approvedAt: null,
    });

    await createPipelineAgentSessionsService({} as never).approveProposal(
      "session-1",
      "proposal-edit-1",
    );

    expect(mockPipelinesService.updateOperationExecutors).toHaveBeenCalledWith([
      { operationId: "review-code", executor },
    ]);
    expect(mockDb.transaction).toHaveBeenCalledOnce();
  });
  it("rejects approval when a proposal still needs user input", async () => {
    mockProposalsDao.findById.mockResolvedValueOnce({
      id: "proposal-needs-answer",
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
        openQuestions: ["Which repository?"],
        readiness: "needs_user_answer",
      },
      createdAt: new Date("2026-06-03T12:00:02.000Z"),
      updatedAt: new Date("2026-06-03T12:00:02.000Z"),
      approvedAt: null,
    });
    const service = createPipelineAgentSessionsService({} as never);

    await expect(service.approveProposal("session-1", "proposal-needs-answer")).rejects.toThrow(
      "not ready for approval",
    );
  });
});

import { readFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
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

vi.mock("../pipelineRunnerService/agentRunner/agentRunner", () => ({
  runAgent: (opts: unknown) => mockRunAgent(opts),
}));

vi.mock("../pipelinesService/createPipelinesService", () => ({
  createPipelinesService: (executor: { pipelinesService?: typeof mockPipelinesService }) =>
    executor?.pipelinesService ?? mockPipelinesService,
}));

import { createPipelineAgentSessionsService as createPipelineAgentSessionsServiceFactory } from "./createPipelineAgentSessionsService";

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
    mockPipelinesService.create.mockImplementation(async (data) => ({
      id: data.id ?? "pipeline-1",
      ...data,
      createdAt: new Date("2026-06-03T12:00:05.000Z"),
      updatedAt: new Date("2026-06-03T12:00:05.000Z"),
    }));
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

  it("creates a new generate session in draft status", async () => {
    const service = createPipelineAgentSessionsService({} as never);

    const session = await service.createSession({
      entrypoint: "new-pipeline-dialog",
      mode: "generate",
    });

    expect(mockSessionsDao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        entrypoint: "new-pipeline-dialog",
        mode: "generate",
        status: "draft",
        pipelineId: null,
        snapshot: null,
      }),
    );
    expect(session.status).toBe("draft");
    expect(session.mode).toBe("generate");
  });

  it("appends a user message to a session", async () => {
    const service = createPipelineAgentSessionsService({} as never);

    const message = await service.appendMessage("session-1", {
      role: "user",
      kind: "text",
      content: "Build me a review pipeline",
    });

    expect(mockMessagesDao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "session-1",
        role: "user",
        kind: "text",
        content: "Build me a review pipeline",
      }),
    );
    expect(message.sessionId).toBe("session-1");
  });

  it("stores a proposal and marks the session as proposal_ready", async () => {
    const service = createPipelineAgentSessionsService({} as never);

    const proposal = await service.saveProposal("session-1", {
      mode: "generate",
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
    });

    expect(mockProposalsDao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "session-1",
        mode: "generate",
        status: "proposal_ready",
      }),
    );
    expect(mockSessionsDao.update).toHaveBeenCalledWith(
      "session-1",
      expect.objectContaining({
        status: "proposal_ready",
        latestProposalId: proposal.id,
      }),
    );
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

  it("rejects approval when updateOperation targets an Operation outside the edit snapshot", async () => {
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
        summary: "Change an unrelated executor",
        targetGraphIntent: "Change an unrelated executor",
        majorChanges: [],
        assumptions: [],
        openQuestions: [],
        actions: [
          {
            type: "updateOperation",
            operationId: "not-on-this-canvas",
            executor: {
              type: "script",
              language: "bash",
              command: "echo no",
              assignmentReason: "This is a deterministic command.",
            },
          },
        ],
        diagnosticsPreview: [],
        readiness: "ready_for_generation",
        pendingOperations: [],
      },
      createdAt: new Date("2026-06-03T12:00:02.000Z"),
      updatedAt: new Date("2026-06-03T12:00:02.000Z"),
      approvedAt: null,
    });

    await expect(
      createPipelineAgentSessionsService({} as never).approveProposal(
        "session-1",
        "proposal-edit-1",
      ),
    ).rejects.toThrow("not used by edit session");
    expect(mockPipelinesService.updateOperationExecutors).not.toHaveBeenCalled();
    expect(mockProposalsDao.update).not.toHaveBeenCalled();
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

  it("rejects approval when a proposal belongs to a different session", async () => {
    mockProposalsDao.findById.mockResolvedValueOnce({
      id: "proposal-foreign",
      sessionId: "session-2",
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
    const service = createPipelineAgentSessionsService({} as never);

    await expect(service.approveProposal("session-1", "proposal-foreign")).rejects.toThrow(
      "does not belong to session",
    );
  });

  it("hydrates a session with messages, attachments, artifacts, and proposals", async () => {
    const service = createPipelineAgentSessionsService({} as never);

    const session = await service.getSessionById("session-1");

    expect(mockSessionsDao.findById).toHaveBeenCalledWith("session-1");
    expect(mockMessagesDao.findManyBySessionId).toHaveBeenCalledWith("session-1");
    expect(mockAttachmentsDao.findManyBySessionId).toHaveBeenCalledWith("session-1");
    expect(mockContextArtifactsDao.findManyBySessionId).toHaveBeenCalledWith("session-1");
    expect(mockProposalsDao.findManyBySessionId).toHaveBeenCalledWith("session-1");
    expect(session?.messages).toHaveLength(1);
    expect(session?.proposals).toHaveLength(1);
  });

  it("recovers an analyzing session when its planning activity is no longer running", async () => {
    mockSessionsDao.findById.mockResolvedValueOnce({
      id: "session-1",
      entrypoint: "new-pipeline-dialog",
      mode: "generate",
      status: "analyzing",
      pipelineId: null,
      snapshot: null,
      latestProposalId: null,
      approvedProposalId: null,
      createdPipelineId: null,
      createdAt: new Date("2026-06-03T12:00:00.000Z"),
      updatedAt: new Date("2026-06-03T12:00:03.000Z"),
    });
    const service = createPipelineAgentSessionsService({} as never);

    const session = await service.getSessionById("session-1");

    expect(mockSessionsDao.update).toHaveBeenCalledWith("session-1", {
      status: "awaiting_user",
    });
    expect(session?.status).toBe("awaiting_user");
  });

  it("returns a follow-up question when planning needs clarification", async () => {
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
        content: "Build me a pipeline",
        createdAt: new Date("2026-06-03T12:00:01.000Z"),
      },
    ]);
    mockRunAgent.mockResolvedValue(
      JSON.stringify({
        type: "question",
        question: "What should the output format be?",
      }),
    );

    const service = createPipelineAgentSessionsService({} as never);
    const result = await service.planSession("session-1");

    expect(result).toEqual({
      type: "question",
      question: "What should the output format be?",
    });
    expect(mockMessagesDao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "session-1",
        role: "assistant",
        kind: "question",
        content: "What should the output format be?",
      }),
    );
    expect(mockSessionsDao.update).toHaveBeenLastCalledWith(
      "session-1",
      expect.objectContaining({ status: "awaiting_user" }),
    );
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

  it("uses the configured default runtime instead of preferring Codex implicitly", async () => {
    mockSettingsDao.get.mockResolvedValueOnce({
      defaultAgentRuntime: "mastra",
      defaultApiKey: "test-key",
      defaultModel: "test-model",
    });
    mockAgentRuntimesDao.findMany.mockResolvedValueOnce([
      {
        id: "runtime-codex",
        name: "Codex Local",
        type: "codex",
        connection: { mode: "local" },
      },
      {
        id: "runtime-mastra",
        name: "Mastra",
        type: "mastra",
        connection: { mode: "local" },
      },
    ]);
    mockRunAgent.mockResolvedValueOnce(
      JSON.stringify({ type: "question", question: "Which output do you want?" }),
    );

    await createPipelineAgentSessionsService({} as never).planSession("session-1");

    expect(mockRunAgent).toHaveBeenCalledWith(expect.objectContaining({ agent: "mastra" }));
  });

  it("starts durable planning with the selected runtime preference", async () => {
    mockSettingsDao.get.mockResolvedValueOnce({
      defaultAgentRuntime: "opencode",
      defaultAgentRuntimeConfigId: "runtime-opencode",
      defaultApiKey: "test-key",
      defaultModel: "legacy-model",
      agentRuntimePreferences: {
        "runtime-opencode": {
          model: "anthropic/claude-sonnet-4-5",
          reasoningEffort: "high",
          speed: "priority",
        },
      },
    });
    mockAgentRuntimesDao.findMany.mockResolvedValueOnce([
      {
        id: "runtime-codex",
        name: "Codex Local",
        type: "codex",
        connection: { mode: "local" },
      },
      {
        id: "runtime-opencode",
        name: "OpenCode Local",
        type: "opencode",
        connection: { mode: "local" },
      },
    ]);
    const service = createPipelineAgentSessionsServiceFactory(mockDb as never, {
      agentRunsService: mockAgentRunsService as never,
    });

    await service.startPlanningRun("session-1");

    expect(mockAgentRunsService.start).toHaveBeenCalledWith(
      expect.objectContaining({
        runtimeConfigId: "runtime-opencode",
        model: "anthropic/claude-sonnet-4-5",
        reasoningEffort: "high",
        speed: "priority",
        permissionMode: "full-access",
        networkAccess: true,
        fullAccessConfirmed: true,
        prompt: expect.stringContaining("=== OUTPUT FORMAT ==="),
        rebuildPrompt: expect.stringContaining("[user/text] Build me a review pipeline"),
      }),
    );
    const startInput = mockAgentRunsService.start.mock.calls[0]?.[0];
    expect(startInput?.prompt).toBe(startInput?.rebuildPrompt);
    expect(startInput?.systemPrompt).toContain("## Active skill — ordine-create-pipeline");
    expect(startInput?.systemPrompt).toContain("不要把所有 Operation 默认串成一条直线");
  });

  it("reseeds the full planning prompt after a completed run failed projection", async () => {
    mockSessionsDao.findById.mockResolvedValueOnce({
      id: "session-1",
      entrypoint: "canvas-agent-panel",
      mode: "generate",
      status: "failed",
      pipelineId: null,
      snapshot: null,
      latestProposalId: null,
      approvedProposalId: null,
      createdPipelineId: null,
    });
    mockAgentRunsService.getLatestByOwner.mockResolvedValueOnce({
      id: "run-with-invalid-projection",
      status: "completed",
    });
    const service = createPipelineAgentSessionsServiceFactory(mockDb as never, {
      agentRunsService: mockAgentRunsService as never,
    });

    await service.startPlanningRun("session-1");

    expect(mockAgentRunsService.start).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("=== OUTPUT FORMAT ==="),
        rebuildPrompt: expect.stringContaining("[user/text] Build me a review pipeline"),
        resumeFromRunId: undefined,
      }),
    );
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

  it("tells generation planning that missing Operations can be created automatically", async () => {
    mockRunAgent.mockResolvedValue(
      JSON.stringify({
        type: "question",
        question: "Which exam sections should be included?",
      }),
    );

    await createPipelineAgentSessionsService({} as never).planSession("session-1");

    const plannerCall = mockRunAgent.mock.calls[0]![0] as {
      systemPrompt: string;
      userPrompt: string;
    };
    expect(plannerCall.systemPrompt).toContain("## Active skill — ordine-create-pipeline");
    expect(plannerCall.systemPrompt).toContain("并行后汇总");
    expect(plannerCall.userPrompt).toContain(
      "AVAILABLE OPERATIONS ARE REUSABLE EXAMPLES, NOT A CAPABILITY LIMIT",
    );
    expect(plannerCall.userPrompt).toContain("can create missing Operations automatically");
    expect(plannerCall.userPrompt).toContain(
      "Do not ask the user to choose a placeholder Pipeline",
    );
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

  it("cancels planning without persisting a late proposal", async () => {
    const deferredAgent = createDeferred<string>();
    mockRunAgent.mockReturnValueOnce(deferredAgent.promise);
    const service = createPipelineAgentSessionsService({} as never);

    const planning = service.planSession("session-1");
    await vi.waitFor(() => expect(mockRunAgent).toHaveBeenCalledOnce());
    await service.cancelSession("session-1");
    deferredAgent.resolve(
      JSON.stringify({
        type: "proposal",
        proposal: {
          mode: "generate",
          purpose: "A late proposal",
          inputs: ["folder"],
          outputs: ["report"],
          majorOperations: [],
          executionFlow: [],
          assumptions: [],
          openQuestions: [],
          readiness: "ready_for_generation",
        },
      }),
    );

    await expect(planning).rejects.toThrow("session cancelled");
    expect(mockProposalsDao.create).not.toHaveBeenCalled();
    expect(mockSessionsDao.update).toHaveBeenLastCalledWith(
      "session-1",
      expect.objectContaining({ status: "awaiting_user" }),
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

  it("generates with a selected local runtime that is absent from the server runtime database", async () => {
    mockSessionsDao.findById.mockResolvedValueOnce({
      id: "session-1",
      entrypoint: "new-pipeline-dialog",
      mode: "generate",
      status: "approved",
      pipelineId: null,
      snapshot: null,
      latestProposalId: "proposal-1",
      approvedProposalId: "proposal-1",
      createdPipelineId: null,
      createdAt: new Date("2026-06-03T12:00:00.000Z"),
      updatedAt: new Date("2026-06-03T12:00:00.000Z"),
    });
    mockMessagesDao.findManyBySessionId.mockResolvedValueOnce([
      {
        id: "message-context",
        sessionId: "session-1",
        role: "system",
        kind: "text",
        content: '{"type":"agent_context"}',
        createdAt: new Date("2026-06-03T12:00:00.500Z"),
      },
      {
        id: "message-1",
        sessionId: "session-1",
        role: "user",
        kind: "text",
        content: "Build me a code review pipeline",
        createdAt: new Date("2026-06-03T12:00:01.000Z"),
      },
    ]);
    mockContextArtifactsDao.findManyBySessionId.mockResolvedValueOnce([]);
    mockAgentRuntimesDao.findMany.mockResolvedValueOnce([]);
    mockRunAgent.mockResolvedValue(
      JSON.stringify({
        nodes: [],
        edges: [],
      }),
    );

    const service = createPipelineAgentSessionsService({} as never);
    const result = await service.generatePipelineFromApprovedProposal("session-1", {
      runtimeId: "local-codex",
    });

    expect(mockPipelinesService.analyzeIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Review repository code",
        description: expect.stringContaining("Purpose: Review repository code"),
        runtimeType: "codex",
      }),
    );
    expect(mockPipelinesService.generateStructure).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Review repository code",
        description: expect.stringContaining("Purpose: Review repository code"),
        matchedOperations: expect.any(Array),
        unmatchedSteps: expect.any(Array),
        runtimeType: "codex",
      }),
    );
    expect(mockPipelinesService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Review repository code",
        nodes: [],
        edges: [],
      }),
    );
    expect(mockSessionsDao.update).toHaveBeenLastCalledWith(
      "session-1",
      expect.objectContaining({
        status: "completed",
        createdPipelineId: result.pipeline.id,
      }),
    );
    expect(mockConversationMessagesDao.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        pipelineId: result.pipeline.id,
        role: "user",
        content: "Build me a code review pipeline",
        phase: "done",
      }),
    );
    expect(mockConversationMessagesDao.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        pipelineId: result.pipeline.id,
        role: "agent",
        content: "Review repository code",
        phase: "done",
      }),
    );
    expect(mockConversationMessagesDao.create).toHaveBeenCalledTimes(2);
  });

  it("creates a real routine with an Agent-generated scheduled pipeline", async () => {
    mockSessionsDao.findById.mockResolvedValueOnce({
      id: "session-1",
      entrypoint: "home",
      mode: "generate",
      status: "approved",
      pipelineId: null,
      snapshot: null,
      latestProposalId: "proposal-1",
      approvedProposalId: "proposal-1",
      createdPipelineId: null,
      createdAt: new Date("2026-06-03T12:00:00.000Z"),
      updatedAt: new Date("2026-06-03T12:00:00.000Z"),
    });
    mockProposalsDao.findById.mockResolvedValueOnce({
      id: "proposal-1",
      sessionId: "session-1",
      mode: "generate",
      status: "approved",
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
      createdAt: new Date("2026-06-03T12:00:02.000Z"),
      updatedAt: new Date("2026-06-03T12:00:02.000Z"),
      approvedAt: new Date("2026-06-03T12:00:03.000Z"),
    });

    const result = await createPipelineAgentSessionsService(
      {} as never,
    ).generatePipelineFromApprovedProposal("session-1");

    expect(mockPipelinesService.generateStructure).toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringContaining(
          "Schedule metadata (do not create an Operation): 0 9 * * 1-5",
        ),
      }),
    );
    expect(mockRoutinesDao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        pipelineId: result.pipeline.id,
        name: "Weekday review",
        cronExpression: "0 9 * * 1-5",
        enabled: true,
        nextRunAt: expect.any(Date),
      }),
    );
  });

  it("does not create a fallback pipeline when generateStructure fails", async () => {
    mockSessionsDao.findById.mockResolvedValueOnce({
      id: "session-1",
      entrypoint: "new-pipeline-dialog",
      mode: "generate",
      status: "approved",
      pipelineId: null,
      snapshot: null,
      latestProposalId: "proposal-1",
      approvedProposalId: "proposal-1",
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
    mockContextArtifactsDao.findManyBySessionId.mockResolvedValueOnce([]);
    mockPipelinesService.generateStructure.mockResolvedValueOnce({
      error: "Agent returned invalid pipeline structure",
    });

    const service = createPipelineAgentSessionsService({} as never);
    await expect(service.generatePipelineFromApprovedProposal("session-1")).rejects.toThrow(
      "Agent returned invalid pipeline structure",
    );

    expect(mockPipelinesService.create).not.toHaveBeenCalled();
    expect(mockSessionsDao.update).toHaveBeenCalledWith(
      "session-1",
      expect.objectContaining({ status: "proposal_ready" }),
    );
  });

  it("cancels generation before any pipeline can be persisted", async () => {
    mockSessionsDao.findById.mockResolvedValue({
      id: "session-1",
      entrypoint: "new-pipeline-dialog",
      mode: "generate",
      status: "approved",
      pipelineId: null,
      snapshot: null,
      latestProposalId: "proposal-1",
      approvedProposalId: "proposal-1",
      createdPipelineId: null,
      createdAt: new Date("2026-06-03T12:00:00.000Z"),
      updatedAt: new Date("2026-06-03T12:00:00.000Z"),
    });
    const deferredStructure = createDeferred<{ nodes: []; edges: [] }>();
    mockPipelinesService.generateStructure.mockReturnValueOnce(deferredStructure.promise);
    const service = createPipelineAgentSessionsService({} as never);

    const generation = service.generatePipelineFromApprovedProposal("session-1");
    await vi.waitFor(() => expect(mockPipelinesService.generateStructure).toHaveBeenCalledOnce());
    await service.cancelSession("session-1");
    deferredStructure.resolve({ nodes: [], edges: [] });

    await expect(generation).rejects.toThrow("session cancelled");
    expect(mockPipelinesService.create).not.toHaveBeenCalled();
    expect(mockSessionsDao.update).toHaveBeenLastCalledWith(
      "session-1",
      expect.objectContaining({
        status: "proposal_ready",
        approvedProposalId: null,
        createdPipelineId: null,
      }),
    );
  });

  it("restores approved proposal state when generation fails so retry can approve again", async () => {
    mockSessionsDao.findById.mockResolvedValueOnce({
      id: "session-1",
      entrypoint: "new-pipeline-dialog",
      mode: "generate",
      status: "approved",
      pipelineId: null,
      snapshot: null,
      latestProposalId: "proposal-1",
      approvedProposalId: "proposal-1",
      createdPipelineId: null,
      createdAt: new Date("2026-06-03T12:00:00.000Z"),
      updatedAt: new Date("2026-06-03T12:00:00.000Z"),
    });
    mockPipelinesService.generateStructure.mockResolvedValueOnce({
      error: "Agent returned invalid pipeline structure",
    });

    const service = createPipelineAgentSessionsService({} as never);
    await expect(service.generatePipelineFromApprovedProposal("session-1")).rejects.toThrow(
      "Agent returned invalid pipeline structure",
    );

    expect(mockProposalsDao.update).toHaveBeenCalledWith(
      "proposal-1",
      expect.objectContaining({
        status: "proposal_ready",
        approvedAt: null,
      }),
    );
    expect(mockSessionsDao.update).toHaveBeenCalledWith(
      "session-1",
      expect.objectContaining({
        status: "proposal_ready",
        approvedProposalId: null,
        latestProposalId: "proposal-1",
      }),
    );
  });

  it("marks a proposal superseded and clears it from the active session", async () => {
    const service = createPipelineAgentSessionsService({} as never);
    await service.supersedeProposal("session-1", "proposal-1");

    expect(mockProposalsDao.update).toHaveBeenCalledWith(
      "proposal-1",
      expect.objectContaining({ status: "superseded" }),
    );
    expect(mockSessionsDao.update).toHaveBeenCalledWith(
      "session-1",
      expect.objectContaining({
        latestProposalId: null,
        status: "awaiting_user",
      }),
    );
  });

  it("extracts text content from plain text attachments", async () => {
    const service = createPipelineAgentSessionsService({} as never);

    const result = await service.ingestAttachment("session-1", {
      bytes: new TextEncoder().encode("hello world"),
      filename: "brief.txt",
      mimeType: "text/plain",
      sizeBytes: 11,
    });

    expect(result.artifacts[0]).toEqual(
      expect.objectContaining({
        kind: "text_extract",
        content: expect.objectContaining({
          text: "hello world",
        }),
      }),
    );
  });

  it("stores attachments under a generated safe path without trusting the uploaded filename", async () => {
    const service = createPipelineAgentSessionsService({} as never);

    const result = await service.ingestAttachment("session-1", {
      bytes: new TextEncoder().encode("hello world"),
      filename: "..\\..\\evil.txt",
      mimeType: "text/plain",
      sizeBytes: 11,
    });

    expect(result.attachment.filename).toBe("..\\..\\evil.txt");
    expect(result.attachment.storageKey).not.toContain("evil.txt");
    expect(result.attachment.storageKey).not.toContain("..");
    expect(result.attachment.storageKey).toMatch(/[\\/][a-f0-9-]+\.txt$/i);
  });

  it("extracts basic text content from docx attachments", async () => {
    const zip = new JSZip();
    zip.file(
      "word/document.xml",
      '<?xml version="1.0" encoding="UTF-8"?><w:document><w:body><w:p><w:r><w:t>Hello DOCX</w:t></w:r></w:p></w:body></w:document>',
    );
    const bytes = new Uint8Array(await zip.generateAsync({ type: "uint8array" }));
    const service = createPipelineAgentSessionsService({} as never);

    const result = await service.ingestAttachment("session-1", {
      bytes,
      filename: "brief.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      sizeBytes: bytes.byteLength,
    });

    expect(result.artifacts[0]).toEqual(
      expect.objectContaining({
        kind: "document_extract",
        content: expect.objectContaining({
          text: expect.stringContaining("Hello DOCX"),
        }),
      }),
    );
  });

  it("extracts text from a real pdf fixture instead of regex-only inline text", async () => {
    const pdfBytes = await readFile(new URL("fixtures/simple.pdf", import.meta.url));
    const service = createPipelineAgentSessionsService({} as never);

    const result = await service.ingestAttachment("session-1", {
      bytes: new Uint8Array(pdfBytes),
      filename: "simple.pdf",
      mimeType: "application/pdf",
      sizeBytes: pdfBytes.byteLength,
    });

    expect(result.artifacts[0]).toEqual(
      expect.objectContaining({
        kind: "document_extract",
        content: expect.objectContaining({
          text: expect.stringContaining("Hello PDF"),
        }),
      }),
    );
  });

  it("uses an agent image attachment to create image summary artifacts", async () => {
    mockSettingsDao.get.mockResolvedValueOnce({
      defaultAgentRuntime: "mastra",
      defaultApiKey: "test-key",
      defaultModel: "vision-model",
    });
    mockAgentRuntimesDao.findMany.mockResolvedValueOnce([
      {
        id: "runtime-mastra",
        name: "Mastra",
        type: "mastra",
        connection: { mode: "api-key" },
      },
    ]);
    mockRunAgent.mockResolvedValueOnce("Visible: task cards and arrows");
    const service = createPipelineAgentSessionsService({} as never);

    const result = await service.ingestAttachment("session-1", {
      bytes: new Uint8Array([1, 2, 3]),
      filename: "diagram.png",
      mimeType: "image/png",
      sizeBytes: 3,
    });

    expect(mockRunAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: "mastra",
        apiKey: "test-key",
        model: "vision-model",
        attachments: [
          expect.objectContaining({
            kind: "image",
            filename: "diagram.png",
            mediaType: "image/png",
            dataBase64: "AQID",
          }),
        ],
      }),
    );
    expect(result.attachment).toEqual(
      expect.objectContaining({
        parseStatus: "parsed",
        parseError: null,
      }),
    );
    expect(result.artifacts[0]).toEqual(
      expect.objectContaining({
        kind: "image_summary",
        content: expect.objectContaining({
          summary: "Visible: task cards and arrows",
          mediaType: "image/png",
        }),
      }),
    );
  });

  it("stores a failed attachment when image runtime lacks vision support", async () => {
    mockRunAgent.mockRejectedValueOnce(
      new Error("codex runtime does not support image attachments"),
    );
    const service = createPipelineAgentSessionsService({} as never);

    const result = await service.ingestAttachment("session-1", {
      bytes: new Uint8Array([1, 2, 3]),
      filename: "diagram.png",
      mimeType: "image/png",
      sizeBytes: 3,
    });

    expect(result.attachment).toEqual(
      expect.objectContaining({
        filename: "diagram.png",
        parseStatus: "failed",
        parseError: expect.stringContaining("does not support image attachments"),
      }),
    );
    expect(result.artifacts).toEqual([]);
  });

  it("removes an attachment and its context artifacts before planning", async () => {
    mockSessionsDao.findById.mockResolvedValueOnce({
      id: "session-1",
      entrypoint: "new-pipeline-dialog",
      mode: "generate",
      status: "draft",
    });
    mockAttachmentsRepository.deleteWithContextArtifacts.mockResolvedValueOnce({
      id: "attachment-1",
      sessionId: "session-1",
      filename: "missing.txt",
      storageKey: "Z:/ordine-tests/missing.txt",
      parseStatus: "parsed",
      parseError: null,
    });
    const service = createPipelineAgentSessionsService({} as never);

    const attachment = await service.removeAttachment("session-1", "attachment-1");

    expect(mockAttachmentsRepository.deleteWithContextArtifacts).toHaveBeenCalledWith(
      "session-1",
      "attachment-1",
    );
    expect(attachment.id).toBe("attachment-1");
  });

  it("rejects attachment removal after planning starts", async () => {
    mockSessionsDao.findById.mockResolvedValueOnce({
      id: "session-1",
      entrypoint: "new-pipeline-dialog",
      mode: "generate",
      status: "analyzing",
    });
    const service = createPipelineAgentSessionsService({} as never);

    await expect(service.removeAttachment("session-1", "attachment-1")).rejects.toThrow(
      "cannot be removed",
    );
    expect(mockAttachmentsRepository.deleteWithContextArtifacts).not.toHaveBeenCalled();
  });
});

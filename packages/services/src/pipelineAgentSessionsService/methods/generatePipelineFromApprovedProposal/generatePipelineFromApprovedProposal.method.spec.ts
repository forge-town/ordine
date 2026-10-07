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
    expect(mockDb.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "serializable",
    });
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
});

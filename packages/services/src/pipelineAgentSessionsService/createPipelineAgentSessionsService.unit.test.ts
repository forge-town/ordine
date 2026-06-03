import { beforeEach, describe, expect, it, vi } from "vitest";

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

const mockPipelinesDao = {
  create: vi.fn(),
};

const mockRunAgent = vi.fn();
const mockExtractJsonFromText = vi.fn((raw: string) => raw);

vi.mock("@repo/models", () => ({
  createAgentRuntimesDao: () => mockAgentRuntimesDao,
  createOperationsDao: () => mockOperationsDao,
  createPipelinesDao: () => mockPipelinesDao,
  createPipelineAgentSessionsDao: () => mockSessionsDao,
  createPipelineAgentMessagesDao: () => mockMessagesDao,
  createPipelineAgentAttachmentsDao: () => mockAttachmentsDao,
  createPipelineAgentContextArtifactsDao: () => mockContextArtifactsDao,
  createPipelineAgentProposalsDao: () => mockProposalsDao,
  createSettingsDao: () => mockSettingsDao,
}));

vi.mock("@repo/agent", () => ({
  extractJsonFromText: (raw: string) => mockExtractJsonFromText(raw),
}));

vi.mock("../pipelineRunnerService/agentRunner/agentRunner", () => ({
  runAgent: (opts: unknown) => mockRunAgent(opts),
}));

import { createPipelineAgentSessionsService } from "./createPipelineAgentSessionsService";

describe("createPipelineAgentSessionsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();

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

  it("generates a new pipeline draft from an approved generate proposal", async () => {
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
    mockRunAgent.mockResolvedValue(
      JSON.stringify({
        nodes: [],
        edges: [],
      }),
    );

    const service = createPipelineAgentSessionsService({} as never);
    const result = await service.generatePipelineFromApprovedProposal("session-1");

    expect(mockRunAgent).toHaveBeenCalled();
    expect(mockPipelinesDao.create).toHaveBeenCalledWith(
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
  });
});

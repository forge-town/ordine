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
});

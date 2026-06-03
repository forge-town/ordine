import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import {
  createAgentRuntimesDao,
  createOperationsDao,
  createPipelinesDao,
  createPipelineAgentAttachmentsDao,
  createPipelineAgentContextArtifactsDao,
  createPipelineAgentMessagesDao,
  createPipelineAgentProposalsDao,
  createPipelineAgentSessionsDao,
  createSettingsDao,
  type DbConnection,
} from "@repo/models";
import { extractJsonFromText } from "@repo/agent";
import {
  PipelineAgentPlanningResultSchema,
  PipelineSchema,
  type PipelineAgentAttachmentParseStatus,
  type PipelineAgentAttachmentSourceType,
  type PipelineAgentContextArtifactContent,
  type PipelineAgentContextArtifactKind,
  type PipelineAgentEntrypoint,
  type PipelineAgentMessageKind,
  type PipelineAgentMessageRole,
  type PipelineAgentMode,
  type PipelineAgentPlanningResult,
  type PipelineAgentProposal,
  type PipelineAgentProposalStatus,
  type PipelineAgentSessionStatus,
  type PipelineGraphSnapshot,
} from "@repo/schemas";
import { runAgent } from "../pipelineRunnerService/agentRunner/agentRunner";

export const createPipelineAgentSessionsService = (db: DbConnection) => {
  const agentRuntimesDao = createAgentRuntimesDao(db);
  const operationsDao = createOperationsDao(db);
  const pipelinesDao = createPipelinesDao(db);
  const sessionsDao = createPipelineAgentSessionsDao(db);
  const messagesDao = createPipelineAgentMessagesDao(db);
  const attachmentsDao = createPipelineAgentAttachmentsDao(db);
  const contextArtifactsDao = createPipelineAgentContextArtifactsDao(db);
  const proposalsDao = createPipelineAgentProposalsDao(db);
  const settingsDao = createSettingsDao(db);

  const buildPlanningPrompt = (input: {
    artifacts: Awaited<ReturnType<typeof contextArtifactsDao.findManyBySessionId>>;
    messages: Awaited<ReturnType<typeof messagesDao.findManyBySessionId>>;
    mode: PipelineAgentMode;
    operations: Awaited<ReturnType<typeof operationsDao.findMany>>;
    pipelineId: string | null;
    snapshot: PipelineGraphSnapshot | null;
  }) => {
    const artifactSummary =
      input.artifacts.length === 0
        ? "(none)"
        : input.artifacts
            .map((artifact) => JSON.stringify({ kind: artifact.kind, content: artifact.content }))
            .join("\n");
    const conversationSummary =
      input.messages.length === 0
        ? "(none)"
        : input.messages
            .map((message) => `[${message.role}/${message.kind}] ${message.content}`)
            .join("\n");

    return [
      "You are a pipeline planning assistant for Ordine.",
      `Planning mode: ${input.mode}`,
      input.mode === "edit"
        ? "Return either a follow-up question or an edit proposal for the current graph."
        : "Return either a follow-up question or a generation proposal for a new pipeline.",
      "",
      "=== OUTPUT FORMAT ===",
      input.mode === "edit"
        ? '{"type":"question","question":"..."} OR {"type":"proposal","proposal":{"mode":"edit","summary":"...","targetGraphIntent":"...","majorChanges":["..."],"assumptions":[],"openQuestions":[],"actions":[],"diagnosticsPreview":[],"readiness":"needs_user_answer|ready_for_generation"}}'
        : '{"type":"question","question":"..."} OR {"type":"proposal","proposal":{"mode":"generate","purpose":"...","inputs":["..."],"outputs":["..."],"majorOperations":["..."],"executionFlow":["..."],"assumptions":[],"openQuestions":[],"readiness":"needs_user_answer|ready_for_generation"}}',
      "",
      `Pipeline ID: ${input.pipelineId ?? "(new pipeline)"}`,
      input.snapshot ? `Current snapshot: ${JSON.stringify(input.snapshot)}` : "Current snapshot: (none)",
      "",
      "=== ATTACHMENT CONTEXT ===",
      artifactSummary,
      "",
      "=== CONVERSATION ===",
      conversationSummary,
      "",
      "=== AVAILABLE OPERATIONS ===",
      JSON.stringify(
        input.operations.map((operation) => ({
          id: operation.id,
          name: operation.name,
          description: operation.description,
          acceptedObjectTypes: operation.acceptedObjectTypes,
        })),
      ),
      "",
      "Return JSON only.",
    ].join("\n");
  };

  const buildGenerationDescription = (proposal: Extract<PipelineAgentProposal, { mode: "generate" }>) =>
    [
      `Purpose: ${proposal.purpose}`,
      `Inputs: ${proposal.inputs.join(", ") || "(none)"}`,
      `Outputs: ${proposal.outputs.join(", ") || "(none)"}`,
      `Major operations: ${proposal.majorOperations.join(", ") || "(none)"}`,
      `Execution flow: ${proposal.executionFlow.join(" -> ") || "(none)"}`,
      proposal.assumptions.length > 0
        ? `Assumptions: ${proposal.assumptions.join("; ")}`
        : "Assumptions: (none)",
      proposal.openQuestions.length > 0
        ? `Open questions: ${proposal.openQuestions.join("; ")}`
        : "Open questions: (none)",
    ].join("\n");

  const decodeText = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

  const getAttachmentKindAndContent = (input: {
    bytes: Uint8Array;
    filename: string;
    mimeType: string;
    sizeBytes: number;
  }): { content: PipelineAgentContextArtifactContent; kind: PipelineAgentContextArtifactKind } => {
    const extension = extname(input.filename).toLowerCase();
    const textExtensions = new Set([".txt", ".md", ".json", ".csv", ".yaml", ".yml"]);
    const documentExtensions = new Set([".pdf", ".docx"]);

    if (input.mimeType.startsWith("image/")) {
      return {
        kind: "image_summary",
        content: {
          mediaType: input.mimeType,
          summary: `Image uploaded: ${input.filename} (${input.mimeType}, ${input.sizeBytes} bytes)`,
          metadata: {
            filename: input.filename,
            sizeBytes: input.sizeBytes,
          },
        },
      };
    }

    if (textExtensions.has(extension) || input.mimeType.startsWith("text/")) {
      const text = decodeText(input.bytes);

      return {
        kind: extension === ".json" || extension === ".csv" ? "structured_summary" : "text_extract",
        content: {
          text,
          summary: text.slice(0, 4000),
          mediaType: input.mimeType,
        },
      };
    }

    if (documentExtensions.has(extension)) {
      return {
        kind: "document_extract",
        content: {
          summary: `Document uploaded: ${input.filename}. v1 stores this as structured document context and keeps the original file for downstream review.`,
          mediaType: input.mimeType,
          metadata: {
            filename: input.filename,
            extension,
            sizeBytes: input.sizeBytes,
          },
        },
      };
    }

    return {
      kind: "structured_summary",
      content: {
        summary: `Attachment uploaded: ${input.filename}`,
        mediaType: input.mimeType,
        metadata: {
          filename: input.filename,
          extension,
          sizeBytes: input.sizeBytes,
        },
      },
    };
  };

  return {
    createSession: async (input: {
      entrypoint: PipelineAgentEntrypoint;
      mode: PipelineAgentMode;
      pipelineId?: string | null;
      snapshot?: PipelineGraphSnapshot | null;
    }) => {
      return sessionsDao.create({
        id: crypto.randomUUID(),
        entrypoint: input.entrypoint,
        mode: input.mode,
        status: "draft" satisfies PipelineAgentSessionStatus,
        pipelineId: input.pipelineId ?? null,
        snapshot: input.snapshot ?? null,
        latestProposalId: null,
        approvedProposalId: null,
        createdPipelineId: null,
      });
    },

    appendMessage: async (
      sessionId: string,
      input: {
        role: PipelineAgentMessageRole;
        kind: PipelineAgentMessageKind;
        content: string;
      },
    ) => {
      return messagesDao.create({
        id: crypto.randomUUID(),
        sessionId,
        role: input.role,
        kind: input.kind,
        content: input.content,
      });
    },

    registerAttachment: async (
      sessionId: string,
      input: {
        filename: string;
        mimeType: string;
        sizeBytes: number;
        sourceType?: PipelineAgentAttachmentSourceType;
        storageKey: string;
        parseStatus?: PipelineAgentAttachmentParseStatus;
        parseError?: string | null;
      },
    ) => {
      return attachmentsDao.create({
        id: crypto.randomUUID(),
        sessionId,
        filename: input.filename,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        sourceType: input.sourceType ?? "upload",
        storageKey: input.storageKey,
        parseStatus: input.parseStatus ?? "pending",
        parseError: input.parseError ?? null,
      });
    },

    ingestAttachment: async (
      sessionId: string,
      input: {
        bytes: Uint8Array;
        filename: string;
        mimeType: string;
        sizeBytes: number;
      },
    ) => {
      const attachmentId = crypto.randomUUID();
      const storageDir = join(tmpdir(), "ordine", "pipeline-agent-sessions", sessionId);
      await mkdir(storageDir, { recursive: true });
      const storageKey = join(storageDir, `${attachmentId}-${input.filename}`);
      await writeFile(storageKey, input.bytes);

      const attachment = await attachmentsDao.create({
        id: attachmentId,
        sessionId,
        filename: input.filename,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        sourceType: "upload",
        storageKey,
        parseStatus: "parsed",
        parseError: null,
      });

      const artifactShape = getAttachmentKindAndContent(input);
      const artifact = await contextArtifactsDao.create({
        id: crypto.randomUUID(),
        sessionId,
        attachmentId,
        kind: artifactShape.kind,
        content: artifactShape.content,
      });

      return { attachment, artifacts: [artifact] };
    },

    saveContextArtifact: async (
      sessionId: string,
      input: {
        attachmentId?: string | null;
        kind: PipelineAgentContextArtifactKind;
        content: PipelineAgentContextArtifactContent;
      },
    ) => {
      return contextArtifactsDao.create({
        id: crypto.randomUUID(),
        sessionId,
        attachmentId: input.attachmentId ?? null,
        kind: input.kind,
        content: input.content,
      });
    },

    saveProposal: async (
      sessionId: string,
      input: {
        mode: PipelineAgentMode;
        proposal: PipelineAgentProposal;
        status?: PipelineAgentProposalStatus;
      },
    ) => {
      const proposal = await proposalsDao.create({
        id: crypto.randomUUID(),
        sessionId,
        mode: input.mode,
        status: input.status ?? "proposal_ready",
        proposal: input.proposal,
        approvedAt: null,
      });

      await sessionsDao.update(sessionId, {
        latestProposalId: proposal.id,
        status: "proposal_ready",
      });

      return proposal;
    },

    approveProposal: async (sessionId: string, proposalId: string) => {
      const proposal = await proposalsDao.findById(proposalId);
      if (!proposal) {
        throw new Error(`Pipeline agent proposal not found: ${proposalId}`);
      }

      await proposalsDao.update(proposalId, {
        status: "approved",
        approvedAt: new Date(),
      });

      await sessionsDao.update(sessionId, {
        status: "approved",
        approvedProposalId: proposalId,
      });
    },

    getSessionById: async (sessionId: string) => {
      const session = await sessionsDao.findById(sessionId);
      if (!session) {
        return null;
      }

      const [messages, attachments, contextArtifacts, proposals] = await Promise.all([
        messagesDao.findManyBySessionId(sessionId),
        attachmentsDao.findManyBySessionId(sessionId),
        contextArtifactsDao.findManyBySessionId(sessionId),
        proposalsDao.findManyBySessionId(sessionId),
      ]);

      return {
        ...session,
        messages,
        attachments,
        contextArtifacts,
        proposals,
      };
    },

    planSession: async (
      sessionId: string,
      input?: {
        onProgress?: (message: string) => Promise<void> | void;
        runtimeId?: string;
      },
    ): Promise<
      | { type: "question"; question: string }
      | { type: "proposal"; proposal: PipelineAgentProposal; proposalId: string }
    > => {
      const session = await sessionsDao.findById(sessionId);
      if (!session) {
        throw new Error(`Pipeline agent session not found: ${sessionId}`);
      }

      await sessionsDao.update(sessionId, { status: "analyzing" });

      const [messages, artifacts, settings, operations, runtimes] = await Promise.all([
        messagesDao.findManyBySessionId(sessionId),
        contextArtifactsDao.findManyBySessionId(sessionId),
        settingsDao.get(),
        operationsDao.findMany(),
        agentRuntimesDao.findMany(),
      ]);

      const selectedRuntime = input?.runtimeId
        ? runtimes.find((runtime) => runtime.id === input.runtimeId) ?? null
        : null;
      const effectiveRuntime =
        selectedRuntime?.type ?? settings.defaultAgentRuntime ?? "codex";

      const raw = await runAgent({
        agent: effectiveRuntime,
        systemPrompt: "You are a fast planning assistant. Return only valid JSON.",
        userPrompt: buildPlanningPrompt({
          artifacts,
          messages,
          mode: session.mode,
          operations,
          pipelineId: session.pipelineId,
          snapshot: session.snapshot,
        }),
        inputPath: process.cwd(),
        agentId: "pipeline-agent-planner",
        allowedTools: [],
        logPrefix: "pipelineAgentPlan",
        apiKey: settings.defaultApiKey,
        model: settings.defaultModel,
        onProgress: input?.onProgress,
      });

      const parsed = PipelineAgentPlanningResultSchema.parse(
        JSON.parse(extractJsonFromText(raw)),
      ) as PipelineAgentPlanningResult;

      if (parsed.type === "question") {
        await messagesDao.create({
          id: crypto.randomUUID(),
          sessionId,
          role: "assistant",
          kind: "question",
          content: parsed.question,
        });
        await sessionsDao.update(sessionId, { status: "awaiting_user" });

        return parsed;
      }

      const saved = await proposalsDao.create({
        id: crypto.randomUUID(),
        sessionId,
        mode: session.mode,
        status: "proposal_ready",
        proposal: parsed.proposal,
        approvedAt: null,
      });
      await sessionsDao.update(sessionId, {
        latestProposalId: saved.id,
        status: "proposal_ready",
      });

      return {
        type: "proposal",
        proposal: parsed.proposal,
        proposalId: saved.id,
      };
    },

    generatePipelineFromApprovedProposal: async (sessionId: string) => {
      const session = await sessionsDao.findById(sessionId);
      if (!session) {
        throw new Error(`Pipeline agent session not found: ${sessionId}`);
      }
      if (session.mode !== "generate") {
        throw new Error(`Session ${sessionId} is not a generate session`);
      }
      if (!session.approvedProposalId) {
        throw new Error(`Session ${sessionId} does not have an approved proposal`);
      }

      const proposalRecord = await proposalsDao.findById(session.approvedProposalId);
      if (!proposalRecord || proposalRecord.proposal.mode !== "generate") {
        throw new Error(`Approved generate proposal not found for session ${sessionId}`);
      }

      const [settings, operations, messages, artifacts, runtimes] = await Promise.all([
        settingsDao.get(),
        operationsDao.findMany(),
        messagesDao.findManyBySessionId(sessionId),
        contextArtifactsDao.findManyBySessionId(sessionId),
        agentRuntimesDao.findMany(),
      ]);
      const effectiveRuntime =
        runtimes.find((runtime) => runtime.type === settings.defaultAgentRuntime)?.type ??
        settings.defaultAgentRuntime ??
        "codex";

      await sessionsDao.update(sessionId, { status: "generating" });

      const raw = await runAgent({
        agent: effectiveRuntime,
        systemPrompt:
          'Generate a pipeline graph JSON object with shape {"nodes":[...],"edges":[...]}. Return JSON only.',
        userPrompt: [
          "Use the approved pipeline proposal to generate the pipeline graph.",
          "",
          buildGenerationDescription(proposalRecord.proposal),
          "",
          "Conversation:",
          messages.map((message) => `[${message.role}] ${message.content}`).join("\n") || "(none)",
          "",
          "Attachment context:",
          artifacts
            .map((artifact) => JSON.stringify({ kind: artifact.kind, content: artifact.content }))
            .join("\n") || "(none)",
          "",
          "Available operations:",
          JSON.stringify(
            operations.map((operation) => ({
              id: operation.id,
              name: operation.name,
              description: operation.description,
              acceptedObjectTypes: operation.acceptedObjectTypes,
            })),
          ),
        ].join("\n"),
        inputPath: process.cwd(),
        agentId: "pipeline-agent-generator",
        allowedTools: [],
        logPrefix: "pipelineAgentGenerate",
        apiKey: settings.defaultApiKey,
        model: settings.defaultModel,
      });

      const parsedGraph = PipelineSchema.pick({ nodes: true, edges: true }).parse(
        JSON.parse(extractJsonFromText(raw)),
      );
      const pipeline = await pipelinesDao.create({
        id: crypto.randomUUID(),
        name: proposalRecord.proposal.purpose,
        description: buildGenerationDescription(proposalRecord.proposal),
        tags: ["agent-generated"],
        timeoutMs: null,
        nodes: parsedGraph.nodes,
        edges: parsedGraph.edges,
      });

      await sessionsDao.update(sessionId, {
        status: "completed",
        createdPipelineId: pipeline.id,
      });

      return { pipeline };
    },
  };
};

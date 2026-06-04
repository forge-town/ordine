import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import JSZip from "jszip";
import { ResultAsync } from "neverthrow";
import { z } from "zod/v4";
import {
  createAgentRuntimesDao,
  createOperationsDao,
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
  type AgentRuntime,
  PipelineAgentPlanReadinessSchema,
  PipelineAgentPlanningResultSchema,
  type PipelineAgentAttachmentParseStatus,
  type PipelineAgentAttachmentSourceType,
  type PipelineAgentContextArtifactContent,
  type PipelineAgentContextArtifactKind,
  type PipelineAgentEntrypoint,
  type PipelineAgentMessageKind,
  type PipelineAgentMessageRole,
  type PipelineAgentMode,
  type PipelineAgentProposal,
  type PipelineAgentProposalStatus,
  type PipelineAgentSessionStatus,
  type PipelineGraphSnapshot,
} from "@repo/schemas";
import { runAgent } from "../pipelineRunnerService/agentRunner/agentRunner";
import { createPipelinesService } from "../pipelinesService/createPipelinesService";

const RelaxedCanvasEditPlanningResultSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("question"),
    question: z.string().min(1),
  }),
  z.object({
    type: z.literal("proposal"),
    proposal: z.object({
      mode: z.literal("edit"),
      summary: z.string().min(1),
      targetGraphIntent: z.string().optional(),
      majorChanges: z.array(z.string()).default([]),
      assumptions: z.array(z.string()).default([]),
      openQuestions: z.array(z.string()).default([]),
      readiness: PipelineAgentPlanReadinessSchema.default("ready_for_generation"),
    }),
  }),
]);
type RelaxedCanvasEditPlanningResult = z.infer<typeof RelaxedCanvasEditPlanningResultSchema>;

export const createPipelineAgentSessionsService = (db: DbConnection) => {
  const agentRuntimesDao = createAgentRuntimesDao(db);
  const operationsDao = createOperationsDao(db);
  const pipelinesService = createPipelinesService(db);
  const sessionsDao = createPipelineAgentSessionsDao(db);
  const messagesDao = createPipelineAgentMessagesDao(db);
  const attachmentsDao = createPipelineAgentAttachmentsDao(db);
  const contextArtifactsDao = createPipelineAgentContextArtifactsDao(db);
  const proposalsDao = createPipelineAgentProposalsDao(db);
  const settingsDao = createSettingsDao(db);
  const resolveEffectiveRuntime = (input: {
    requestedRuntimeId?: string;
    runtimes: Array<{ id: string; type: AgentRuntime } & Record<string, unknown>>;
    defaultRuntime?: string | null;
  }): AgentRuntime => {
    if (input.requestedRuntimeId) {
      const requested = input.runtimes.find((runtime) => runtime.id === input.requestedRuntimeId);
      if (requested) {
        return requested.type;
      }
    }

    const codexRuntime = input.runtimes.find((runtime) => runtime.type === "codex");
    if (codexRuntime) {
      return "codex";
    }

    const defaultRuntime =
      input.defaultRuntime && input.runtimes.find((runtime) => runtime.type === input.defaultRuntime);
    if (defaultRuntime) {
      return defaultRuntime.type;
    }

    return input.runtimes[0]?.type ?? "codex";
  };

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

  const buildArtifactSummary = (
    artifacts: Awaited<ReturnType<typeof contextArtifactsDao.findManyBySessionId>>,
  ) =>
    artifacts.length === 0
      ? "(none)"
      : artifacts
          .map((artifact) => {
            const summary =
              typeof artifact.content.summary === "string" && artifact.content.summary.trim().length > 0
                ? artifact.content.summary
                : JSON.stringify(artifact.content);

            return `- ${artifact.kind}: ${summary}`;
          })
          .join("\n");

  const decodeText = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
  const normalizeWhitespace = (value: string) => value.replaceAll(/\s+/g, " ").trim();
  const extractPdfText = (bytes: Uint8Array) => {
    const raw = decodeText(bytes);
    const matches = [...raw.matchAll(/\(([^()]+)\)/g)].map((match) => match[1] ?? "");

    return normalizeWhitespace(matches.join(" "));
  };
  const extractDocxText = async (bytes: Uint8Array) => {
    const zip = await JSZip.loadAsync(bytes);
    const documentXml = await zip.file("word/document.xml")?.async("string");
    if (!documentXml) {
      return "";
    }

    return normalizeWhitespace(
      documentXml
        .replaceAll(/<[^>]+>/g, " ")
        .replaceAll(/&amp;/g, "&")
        .replaceAll(/&lt;/g, "<")
        .replaceAll(/&gt;/g, ">"),
    );
  };

  const getAttachmentKindAndContent = async (input: {
    bytes: Uint8Array;
    filename: string;
    mimeType: string;
    sizeBytes: number;
  }): Promise<{
    content: PipelineAgentContextArtifactContent;
    kind: PipelineAgentContextArtifactKind;
  }> => {
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
      const extractedText = extension === ".docx" ? await extractDocxText(input.bytes) : extractPdfText(input.bytes);

      return {
        kind: "document_extract",
        content: {
          text: extractedText,
          summary:
            extractedText.length > 0
              ? extractedText.slice(0, 4000)
              : `Document uploaded: ${input.filename}.`,
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

      const artifactShape = await getAttachmentKindAndContent(input);
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
      const effectiveRuntime = resolveEffectiveRuntime({
        requestedRuntimeId: input?.runtimeId,
        runtimes,
        defaultRuntime: settings.defaultAgentRuntime ?? null,
      });

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

      const parsed = (session.mode === "edit"
        ? RelaxedCanvasEditPlanningResultSchema
        : PipelineAgentPlanningResultSchema
      ).parse(JSON.parse(extractJsonFromText(raw)));

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

      if (session.mode === "edit") {
        const editProposal = (
          parsed as Extract<RelaxedCanvasEditPlanningResult, { type: "proposal" }>
        ).proposal;
        if (!session.snapshot) {
          throw new Error(`Edit session ${sessionId} is missing a graph snapshot`);
        }

        const actionRequest = [
          editProposal.summary,
          editProposal.targetGraphIntent
            ? `Target intent: ${editProposal.targetGraphIntent}`
            : null,
          editProposal.majorChanges.length > 0
            ? `Requested changes: ${editProposal.majorChanges.join("; ")}`
            : null,
          editProposal.assumptions.length > 0
            ? `Assumptions: ${editProposal.assumptions.join("; ")}`
            : null,
        ]
          .filter(Boolean)
          .join("\n");
        const actionProposalResult = await pipelinesService.proposeActions({
          snapshot: session.snapshot,
          message: actionRequest,
          pipelineId: session.pipelineId ?? undefined,
          runtimeId: input?.runtimeId,
        });
        if (!actionProposalResult.proposal) {
          throw new Error("Failed to generate executable canvas edit actions");
        }

        const finalEditProposal: PipelineAgentProposal = {
          mode: "edit",
          summary: editProposal.summary,
          targetGraphIntent: editProposal.targetGraphIntent ?? editProposal.summary,
          majorChanges: editProposal.majorChanges,
          assumptions: editProposal.assumptions,
          openQuestions: editProposal.openQuestions,
          actions: actionProposalResult.proposal.actions,
          diagnosticsPreview: actionProposalResult.diagnostics,
          readiness: editProposal.readiness,
        };
        const saved = await proposalsDao.create({
          id: crypto.randomUUID(),
          sessionId,
          mode: session.mode,
          status: "proposal_ready",
          proposal: finalEditProposal,
          approvedAt: null,
        });
        await sessionsDao.update(sessionId, {
          latestProposalId: saved.id,
          status: "proposal_ready",
        });

        return {
          type: "proposal",
          proposal: finalEditProposal,
          proposalId: saved.id,
        };
      }

      const generateProposal = parsed.proposal as Extract<PipelineAgentProposal, { mode: "generate" }>;
      const saved = await proposalsDao.create({
        id: crypto.randomUUID(),
        sessionId,
        mode: session.mode,
        status: "proposal_ready",
        proposal: generateProposal,
        approvedAt: null,
      });
      await sessionsDao.update(sessionId, {
        latestProposalId: saved.id,
        status: "proposal_ready",
      });

      return {
        type: "proposal",
        proposal: generateProposal,
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

      const [messages, artifacts, settings, runtimes] = await Promise.all([
        messagesDao.findManyBySessionId(sessionId),
        contextArtifactsDao.findManyBySessionId(sessionId),
        settingsDao.get(),
        agentRuntimesDao.findMany(),
      ]);
      const effectiveRuntime = resolveEffectiveRuntime({
        runtimes,
        defaultRuntime: settings.defaultAgentRuntime ?? null,
      });
      const pipelineName = proposalRecord.proposal.purpose;
      const pipelineDescription = [
        buildGenerationDescription(proposalRecord.proposal),
        "Conversation context:",
        messages.map((message) => `[${message.role}/${message.kind}] ${message.content}`).join("\n") || "(none)",
        "",
        "Attachment context:",
        buildArtifactSummary(artifacts),
      ].join("\n\n");

      await sessionsDao.update(sessionId, { status: "generating" });

      const generationResult = await ResultAsync.fromPromise(
        (async () => {
          const analysis = await pipelinesService.analyzeIntent({
            name: pipelineName,
            description: pipelineDescription,
            runtimeType: effectiveRuntime,
          });
          const generated = await pipelinesService.generateStructure({
            name: pipelineName,
            description: pipelineDescription,
            matchedOperations: analysis.matchedOperations,
            unmatchedSteps: analysis.unmatchedSteps,
            runtimeType: effectiveRuntime,
          });
          if ("error" in generated) {
            throw new Error(generated.error);
          }
          if (generated.pendingOperations && generated.pendingOperations.length > 0) {
            await pipelinesService.createPendingOperations(generated.pendingOperations);
          }

          return pipelinesService.create({
            id: crypto.randomUUID(),
            name: pipelineName,
            description: pipelineDescription,
            tags: ["agent-generated"],
            timeoutMs: null,
            nodes: generated.nodes,
            edges: generated.edges,
          });
        })(),
        (error) => (error instanceof Error ? error : new Error(String(error))),
      );
      if (generationResult.isErr()) {
        await sessionsDao.update(sessionId, { status: "proposal_ready" });
        throw generationResult.error;
      }

      const pipeline = generationResult.value;

      await sessionsDao.update(sessionId, {
        status: "completed",
        createdPipelineId: pipeline.id,
      });

      return { pipeline };
    },
  };
};

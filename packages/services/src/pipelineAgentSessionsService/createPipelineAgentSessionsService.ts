import { mkdir, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, resolve, sep } from "node:path";
import { inflateSync } from "node:zlib";
import JSZip from "jszip";
import { Result, ResultAsync } from "neverthrow";
import { z } from "zod/v4";
import {
  createAgentRuntimesDao,
  createOperationsDao,
  createPipelineAgentAttachmentsDao,
  createPipelineAgentAttachmentsRepository,
  createPipelineAgentContextArtifactsDao,
  createPipelineAgentMessagesDao,
  createPipelineAgentProposalsDao,
  createPipelineAgentSessionsDao,
  createRoutinesDao,
  createSettingsDao,
  type DbConnection,
} from "@repo/models";
import { extractJsonFromText } from "@repo/agent";
import {
  type AgentRuntime,
  PipelineAgentPlanReadinessSchema,
  PipelineAgentPlanningResultSchema,
  type ObjectNodeType,
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
  parseLocalAgentRuntimeId,
} from "@repo/schemas";
import { getNextCronRunAt } from "@repo/utils";
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

export const PIPELINE_AGENT_MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

const toSafeStoragePath = (sessionId: string, attachmentId: string, filename: string) => {
  const storageDir = resolve(
    tmpdir(),
    "ordine",
    "pipeline-agent-sessions",
    sessionId.replaceAll(/[^a-zA-Z0-9_-]/g, "_"),
  );
  const extension = extname(filename)
    .replaceAll(/[^a-zA-Z0-9.]/g, "")
    .slice(0, 16);
  const storageKey = resolve(storageDir, `${attachmentId}${extension}`);

  if (!storageKey.startsWith(`${storageDir}${sep}`) && storageKey !== storageDir) {
    throw new Error("Attachment storage path escaped the session directory");
  }

  return { storageDir, storageKey };
};

type PipelineAgentActivityKind = "planning" | "generating";

interface PipelineAgentActivity {
  controller: AbortController;
  kind: PipelineAgentActivityKind;
}

const createCancellationError = (sessionId: string) => {
  const error = new Error(`Pipeline agent session cancelled: ${sessionId}`) as Error & {
    code: string;
  };
  error.code = "PIPELINE_AGENT_CANCELLED";

  return error;
};

const createRuntimeNotFoundError = (runtimeId?: string) => {
  const error = new Error(
    runtimeId
      ? `Configured Agent runtime not found: ${runtimeId}`
      : "No Agent runtime is configured",
  ) as Error & { code: string };
  error.code = "PIPELINE_AGENT_RUNTIME_NOT_FOUND";

  return error;
};

const isCancellationError = (error: Error) =>
  (error as Error & { code?: string }).code === "PIPELINE_AGENT_CANCELLED";

const runAbortable = <T>(promise: Promise<T>, signal: AbortSignal, sessionId: string) =>
  new Promise<T>((resolvePromise, rejectPromise) => {
    const handleAbort = () => rejectPromise(createCancellationError(sessionId));
    if (signal.aborted) {
      handleAbort();

      return;
    }

    signal.addEventListener("abort", handleAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", handleAbort);
        resolvePromise(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", handleAbort);
        rejectPromise(error);
      },
    );
  });

export const createPipelineAgentSessionsService = (db: DbConnection) => {
  const agentRuntimesDao = createAgentRuntimesDao(db);
  const operationsDao = createOperationsDao(db);
  const pipelinesService = createPipelinesService(db);
  const sessionsDao = createPipelineAgentSessionsDao(db);
  const messagesDao = createPipelineAgentMessagesDao(db);
  const attachmentsDao = createPipelineAgentAttachmentsDao(db);
  const attachmentsRepository = createPipelineAgentAttachmentsRepository(db);
  const contextArtifactsDao = createPipelineAgentContextArtifactsDao(db);
  const proposalsDao = createPipelineAgentProposalsDao(db);
  const settingsDao = createSettingsDao(db);
  const activeActivities = new Map<string, PipelineAgentActivity>();
  const beginActivity = (sessionId: string, kind: PipelineAgentActivityKind) => {
    activeActivities.get(sessionId)?.controller.abort();
    const activity = { controller: new AbortController(), kind } satisfies PipelineAgentActivity;
    activeActivities.set(sessionId, activity);

    return activity;
  };
  const assertActivityActive = (sessionId: string, activity: PipelineAgentActivity) => {
    if (
      activity.controller.signal.aborted ||
      activeActivities.get(sessionId)?.controller !== activity.controller
    ) {
      throw createCancellationError(sessionId);
    }
  };
  const finishActivity = (sessionId: string, activity: PipelineAgentActivity) => {
    if (activeActivities.get(sessionId)?.controller === activity.controller) {
      activeActivities.delete(sessionId);
    }
  };
  const resolveEffectiveRuntime = (input: {
    requestedRuntimeId?: string;
    runtimes: Array<{ id: string; type: AgentRuntime } & Record<string, unknown>>;
    defaultRuntime?: string | null;
  }): AgentRuntime | null => {
    if (input.requestedRuntimeId) {
      const requested = input.runtimes.find((runtime) => runtime.id === input.requestedRuntimeId);

      return requested?.type ?? parseLocalAgentRuntimeId(input.requestedRuntimeId);
    }

    const defaultRuntime =
      input.defaultRuntime &&
      input.runtimes.find((runtime) => runtime.type === input.defaultRuntime);
    if (defaultRuntime) {
      return defaultRuntime.type;
    }

    return input.runtimes[0]?.type ?? null;
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
        : '{"type":"question","question":"..."} OR {"type":"proposal","proposal":{"mode":"generate","purpose":"...","inputs":["..."],"outputs":["..."],"majorOperations":["..."],"executionFlow":["..."],"assumptions":[],"openQuestions":[],"schedule":null|{"name":"...","cronExpression":"0 9 * * 1-5","enabled":true},"readiness":"needs_user_answer|ready_for_generation"}}',
      input.mode === "generate"
        ? "Only include schedule when the user explicitly requests recurring execution. A schedule is Pipeline metadata, never a majorOperation. Use a valid 5-field cron expression in the server's local timezone; ask a follow-up question when the requested time is ambiguous."
        : "",
      input.mode === "generate"
        ? "AVAILABLE OPERATIONS ARE REUSABLE EXAMPLES, NOT A CAPABILITY LIMIT. The generation phase can create missing Operations automatically. When the user's goal, inputs, and outputs are sufficiently clear, propose every required majorOperation (including new ones) and set readiness to ready_for_generation. Do not ask the user to choose a placeholder Pipeline or manually extend Operations first."
        : "",
      "",
      `Pipeline ID: ${input.pipelineId ?? "(new pipeline)"}`,
      input.snapshot
        ? `Current snapshot: ${JSON.stringify(input.snapshot)}`
        : "Current snapshot: (none)",
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

  const buildGenerationDescription = (
    proposal: Extract<PipelineAgentProposal, { mode: "generate" }>,
  ) =>
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
      proposal.schedule
        ? `Schedule metadata (do not create an Operation): ${proposal.schedule.cronExpression}`
        : "Schedule metadata: (none)",
    ].join("\n");

  const buildArtifactSummary = (
    artifacts: Awaited<ReturnType<typeof contextArtifactsDao.findManyBySessionId>>,
  ) =>
    artifacts.length === 0
      ? "(none)"
      : artifacts
          .map((artifact) => {
            const summary =
              typeof artifact.content.summary === "string" &&
              artifact.content.summary.trim().length > 0
                ? artifact.content.summary
                : JSON.stringify(artifact.content);

            return `- ${artifact.kind}: ${summary}`;
          })
          .join("\n");

  const decodeText = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
  const normalizeWhitespace = (value: string) => value.replaceAll(/\s+/g, " ").trim();
  const decodePdfBinary = (bytes: Uint8Array) => Buffer.from(bytes).toString("latin1");
  const decodePdfTextBytes = (bytes: number[]) => {
    if (bytes[0] === 0xfe && bytes[1] === 0xff) {
      return Array.from({ length: Math.floor((bytes.length - 2) / 2) }, (_, offset) => {
        const index = 2 + offset * 2;

        return String.fromCodePoint((bytes[index]! << 8) | bytes[index + 1]!);
      }).join("");
    }

    return Buffer.from(bytes).toString("utf8");
  };
  const readLiteralPdfString = (input: string, startIndex: number) => {
    const readNext = (
      index: number,
      depth: number,
      value: string,
    ): { nextIndex: number; value: string } => {
      if (index >= input.length || depth <= 0) {
        return { value, nextIndex: index };
      }

      const char = input[index]!;
      if (char === "\\") {
        const escaped = input[index + 1];
        if (!escaped) {
          return readNext(index + 1, depth, value);
        }
        if (/[0-7]/.test(escaped)) {
          const octal = input.slice(index + 1, index + 4).match(/^[0-7]{1,3}/)?.[0] ?? "";

          return readNext(
            index + 1 + octal.length,
            depth,
            `${value}${String.fromCodePoint(Number.parseInt(octal, 8))}`,
          );
        }
        const escapedMap: Record<string, string> = {
          n: "\n",
          r: "\r",
          t: "\t",
          b: "\b",
          f: "\f",
          "(": "(",
          ")": ")",
          "\\": "\\",
        };

        return readNext(index + 2, depth, `${value}${escapedMap[escaped] ?? escaped}`);
      }
      if (char === "(") {
        return readNext(index + 1, depth + 1, `${value}${char}`);
      }
      if (char === ")") {
        const nextDepth = depth - 1;

        return readNext(index + 1, nextDepth, nextDepth > 0 ? `${value}${char}` : value);
      }

      return readNext(index + 1, depth, `${value}${char}`);
    };

    return readNext(startIndex + 1, 1, "");
  };
  const readHexPdfString = (input: string, startIndex: number) => {
    const endIndex = input.indexOf(">", startIndex + 1);
    if (endIndex === -1) {
      return { value: "", nextIndex: input.length };
    }

    const rawHex = input.slice(startIndex + 1, endIndex).replaceAll(/\s+/g, "");
    const normalizedHex = rawHex.length % 2 === 0 ? rawHex : `${rawHex}0`;
    const bytes = Array.from({ length: Math.floor(normalizedHex.length / 2) }, (_, offset) =>
      Number.parseInt(normalizedHex.slice(offset * 2, offset * 2 + 2), 16),
    ).filter((value) => !Number.isNaN(value));

    return { value: decodePdfTextBytes(bytes), nextIndex: endIndex + 1 };
  };
  const extractPdfStreamBodies = (bytes: Uint8Array) => {
    const raw = decodePdfBinary(bytes);
    const readBodies = (searchIndex: number, bodies: string[]): string[] => {
      if (searchIndex >= raw.length) {
        return bodies;
      }

      const streamIndex = raw.indexOf("stream", searchIndex);
      if (streamIndex === -1) {
        return bodies;
      }
      const bodyStartBeforeLineBreak = streamIndex + "stream".length;
      const bodyStart =
        raw[bodyStartBeforeLineBreak] === "\r" && raw[bodyStartBeforeLineBreak + 1] === "\n"
          ? bodyStartBeforeLineBreak + 2
          : raw[bodyStartBeforeLineBreak] === "\n" || raw[bodyStartBeforeLineBreak] === "\r"
            ? bodyStartBeforeLineBreak + 1
            : bodyStartBeforeLineBreak;
      const endIndex = raw.indexOf("endstream", bodyStart);
      if (endIndex === -1) {
        return bodies;
      }

      const dictionaryStart = raw.lastIndexOf("<<", streamIndex);
      const dictionaryEnd = raw.lastIndexOf(">>", streamIndex);
      const dictionary =
        dictionaryStart !== -1 && dictionaryEnd !== -1 && dictionaryEnd > dictionaryStart
          ? raw.slice(dictionaryStart, dictionaryEnd)
          : "";
      const bodyBytes = bytes.slice(bodyStart, endIndex);
      const decodedBytes = dictionary.includes("/FlateDecode")
        ? Result.fromThrowable(
            () => inflateSync(Buffer.from(bodyBytes)),
            (error) => error,
          )().unwrapOr(Buffer.from(bodyBytes))
        : Buffer.from(bodyBytes);

      return readBodies(endIndex + "endstream".length, [...bodies, decodePdfBinary(decodedBytes)]);
    };

    const bodies = readBodies(0, []);

    return bodies.length > 0 ? bodies : [raw];
  };
  const extractPdfTextTokens = (input: string) => {
    const readTokens = (index: number, segments: string[]): string[] => {
      if (index >= input.length) {
        return segments;
      }

      const char = input[index]!;
      if (char === "(") {
        const parsed = readLiteralPdfString(input, index);

        return readTokens(parsed.nextIndex, [...segments, parsed.value]);
      }
      if (char === "<" && input[index + 1] !== "<") {
        const parsed = readHexPdfString(input, index);

        return readTokens(parsed.nextIndex, parsed.value ? [...segments, parsed.value] : segments);
      }

      return readTokens(index + 1, segments);
    };

    return readTokens(0, []);
  };
  const extractPdfText = (bytes: Uint8Array) => {
    const streamBodies = extractPdfStreamBodies(bytes);
    const textSegments = streamBodies.flatMap((body) => extractPdfTextTokens(body));

    return normalizeWhitespace(textSegments.join(" "));
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
        .replaceAll("&amp;", "&")
        .replaceAll("&lt;", "<")
        .replaceAll("&gt;", ">"),
    );
  };

  const resolveAttachmentRuntime = (input: {
    requestedRuntimeId?: string;
    runtimes: Array<{ id: string; type: AgentRuntime } & Record<string, unknown>>;
    defaultRuntime?: string | null;
  }): AgentRuntime | null => resolveEffectiveRuntime(input);

  const createImageSummaryArtifact = async (input: {
    bytes: Uint8Array;
    filename: string;
    mimeType: string;
    runtime: AgentRuntime;
    apiKey?: string;
    model?: string;
  }): Promise<{
    content: PipelineAgentContextArtifactContent;
    kind: PipelineAgentContextArtifactKind;
  }> => {
    const summary = await runAgent({
      agent: input.runtime,
      systemPrompt:
        "Describe the uploaded image for workflow planning. Return a concise text summary.",
      userPrompt: "Summarize visible text, objects, structure, and workflow-relevant clues.",
      inputPath: process.cwd(),
      agentId: "pipeline-agent-image-summary",
      logPrefix: "pipelineAgentImage",
      apiKey: input.apiKey,
      model: input.model,
      attachments: [
        {
          kind: "image",
          filename: input.filename,
          mediaType: input.mimeType,
          dataBase64: Buffer.from(input.bytes).toString("base64"),
        },
      ],
    });

    return {
      kind: "image_summary",
      content: {
        mediaType: input.mimeType,
        summary,
        metadata: {
          filename: input.filename,
          sizeBytes: input.bytes.byteLength,
        },
      },
    };
  };

  const getAttachmentKindAndContent = async (input: {
    bytes: Uint8Array;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    runtimeId?: string;
  }): Promise<{
    content: PipelineAgentContextArtifactContent;
    kind: PipelineAgentContextArtifactKind;
  }> => {
    const extension = extname(input.filename).toLowerCase();
    const textExtensions = new Set([".txt", ".md", ".json", ".csv", ".yaml", ".yml"]);
    const documentExtensions = new Set([".pdf", ".docx"]);

    if (input.mimeType.startsWith("image/")) {
      const [settings, runtimes] = await Promise.all([
        settingsDao.get(),
        agentRuntimesDao.findMany(),
      ]);
      const runtime = resolveAttachmentRuntime({
        requestedRuntimeId: input.runtimeId,
        runtimes,
        defaultRuntime: settings.defaultAgentRuntime ?? null,
      });
      if (!runtime) {
        throw createRuntimeNotFoundError(input.runtimeId);
      }

      return createImageSummaryArtifact({
        bytes: input.bytes,
        filename: input.filename,
        mimeType: input.mimeType,
        runtime,
        apiKey: settings.defaultApiKey,
        model: settings.defaultModel,
      });
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
      const extractedText =
        extension === ".docx" ? await extractDocxText(input.bytes) : extractPdfText(input.bytes);

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
        runtimeId?: string;
      },
    ) => {
      const attachmentId = crypto.randomUUID();
      if (
        input.sizeBytes > PIPELINE_AGENT_MAX_ATTACHMENT_BYTES ||
        input.bytes.byteLength > PIPELINE_AGENT_MAX_ATTACHMENT_BYTES
      ) {
        throw new Error(
          `Attachment exceeds the ${PIPELINE_AGENT_MAX_ATTACHMENT_BYTES} byte size limit`,
        );
      }

      const { storageDir, storageKey } = toSafeStoragePath(sessionId, attachmentId, input.filename);
      await mkdir(storageDir, { recursive: true });
      await writeFile(storageKey, input.bytes);

      const artifactShapeResult = await ResultAsync.fromPromise(
        getAttachmentKindAndContent(input),
        (error) => (error instanceof Error ? error : new Error(String(error))),
      );
      if (artifactShapeResult.isErr()) {
        const attachment = await attachmentsDao.create({
          id: attachmentId,
          sessionId,
          filename: input.filename,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          sourceType: "upload",
          storageKey,
          parseStatus: "failed",
          parseError: artifactShapeResult.error.message,
        });

        return { attachment, artifacts: [] };
      }

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

      const artifactShape = artifactShapeResult.value;
      const artifact = await contextArtifactsDao.create({
        id: crypto.randomUUID(),
        sessionId,
        attachmentId,
        kind: artifactShape.kind,
        content: artifactShape.content,
      });

      return { attachment, artifacts: [artifact] };
    },

    removeAttachment: async (sessionId: string, attachmentId: string) => {
      const session = await sessionsDao.findById(sessionId);
      if (!session) {
        throw new Error(`Pipeline agent session not found: ${sessionId}`);
      }
      if (session.status !== "draft" && session.status !== "awaiting_user") {
        throw new Error(
          `Pipeline agent attachment cannot be removed while session ${sessionId} is ${session.status}`,
        );
      }

      const attachment = await attachmentsRepository.deleteWithContextArtifacts(
        sessionId,
        attachmentId,
      );
      if (!attachment) {
        throw new Error(`Pipeline agent attachment not found: ${attachmentId}`);
      }

      const unlinkResult = await ResultAsync.fromPromise(unlink(attachment.storageKey), (error) =>
        error instanceof Error ? error : new Error(String(error)),
      );
      if (unlinkResult.isErr() && (unlinkResult.error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw unlinkResult.error;
      }

      return attachment;
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
      const session = await sessionsDao.findById(sessionId);
      if (!session) {
        throw new Error(`Pipeline agent session not found: ${sessionId}`);
      }

      const proposal = await proposalsDao.findById(proposalId);
      if (!proposal) {
        throw new Error(`Pipeline agent proposal not found: ${proposalId}`);
      }
      if (proposal.sessionId !== sessionId) {
        throw new Error(
          `Pipeline agent proposal ${proposalId} does not belong to session ${sessionId}`,
        );
      }
      if (proposal.mode !== session.mode) {
        throw new Error(
          `Pipeline agent proposal ${proposalId} mode does not match session ${sessionId}`,
        );
      }
      if (proposal.status !== "proposal_ready") {
        throw new Error(
          `Pipeline agent proposal ${proposalId} cannot be approved from status ${proposal.status}`,
        );
      }
      if (proposal.proposal.readiness !== "ready_for_generation") {
        throw new Error(`Pipeline agent proposal ${proposalId} is not ready for approval`);
      }

      if (proposal.proposal.mode === "edit" && proposal.proposal.pendingOperations?.length > 0) {
        await pipelinesService.createPendingOperations(
          proposal.proposal.pendingOperations.map((op) => ({
            ...op,
            acceptedObjectTypes: op.acceptedObjectTypes as ObjectNodeType[],
          })),
        );
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

    supersedeProposal: async (sessionId: string, proposalId: string) => {
      const proposal = await proposalsDao.findById(proposalId);
      if (!proposal || proposal.sessionId !== sessionId) {
        throw new Error(`Pipeline agent proposal not found for session ${sessionId}`);
      }

      await proposalsDao.update(proposalId, { status: "superseded" });

      const session = await sessionsDao.findById(sessionId);
      if (session?.latestProposalId === proposalId) {
        await sessionsDao.update(sessionId, {
          latestProposalId: null,
          status: "awaiting_user",
        });
      }
    },

    getSessionById: async (sessionId: string) => {
      const storedSession = await sessionsDao.findById(sessionId);
      if (!storedSession) {
        return null;
      }

      const session =
        storedSession.status === "analyzing" && !activeActivities.has(sessionId)
          ? {
              ...storedSession,
              ...(await sessionsDao.update(sessionId, { status: "awaiting_user" })),
              status: "awaiting_user" as const,
            }
          : storedSession;

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

    cancelSession: async (sessionId: string) => {
      const session = await sessionsDao.findById(sessionId);
      if (!session) {
        throw new Error(`Pipeline agent session not found: ${sessionId}`);
      }

      const activity = activeActivities.get(sessionId);
      activity?.controller.abort();

      if (activity?.kind === "planning" || session.status === "analyzing") {
        await sessionsDao.update(sessionId, { status: "awaiting_user" });

        return { status: "awaiting_user" as const };
      }

      if (
        activity?.kind === "generating" ||
        session.status === "approved" ||
        session.status === "generating"
      ) {
        const proposalId = session.approvedProposalId ?? session.latestProposalId;
        if (proposalId) {
          await proposalsDao.update(proposalId, {
            status: "proposal_ready",
            approvedAt: null,
          });
        }
        await sessionsDao.update(sessionId, {
          status: "proposal_ready",
          latestProposalId: proposalId ?? session.latestProposalId,
          approvedProposalId: null,
          createdPipelineId: null,
        });

        return { status: "proposal_ready" as const };
      }

      return { status: session.status };
    },

    planSession: async (
      sessionId: string,
      input?: {
        onProgress?: (message: string) => Promise<void> | void;
        runtimeId?: string;
        signal?: AbortSignal;
      },
    ): Promise<
      | { type: "question"; question: string }
      | { type: "proposal"; proposal: PipelineAgentProposal; proposalId: string }
    > => {
      const session = await sessionsDao.findById(sessionId);
      if (!session) {
        throw new Error(`Pipeline agent session not found: ${sessionId}`);
      }

      const activity = beginActivity(sessionId, "planning");
      const handleExternalAbort = () => activity.controller.abort();
      input?.signal?.addEventListener("abort", handleExternalAbort, { once: true });

      const planningResult = await ResultAsync.fromPromise(
        (async () => {
          await sessionsDao.update(sessionId, { status: "analyzing" });
          assertActivityActive(sessionId, activity);
          const [messages, artifacts, settings, operations, runtimes] = await Promise.all([
            messagesDao.findManyBySessionId(sessionId),
            contextArtifactsDao.findManyBySessionId(sessionId),
            settingsDao.get(),
            operationsDao.findMany(),
            agentRuntimesDao.findMany(),
          ]);
          assertActivityActive(sessionId, activity);
          const effectiveRuntime = resolveEffectiveRuntime({
            requestedRuntimeId: input?.runtimeId,
            runtimes,
            defaultRuntime: settings.defaultAgentRuntime ?? null,
          });
          if (!effectiveRuntime) {
            throw createRuntimeNotFoundError(input?.runtimeId);
          }

          const raw = await runAbortable(
            runAgent({
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
            }),
            activity.controller.signal,
            sessionId,
          );
          assertActivityActive(sessionId, activity);

          const parsed = (
            session.mode === "edit"
              ? RelaxedCanvasEditPlanningResultSchema
              : PipelineAgentPlanningResultSchema
          ).parse(JSON.parse(extractJsonFromText(raw)));
          assertActivityActive(sessionId, activity);

          if (parsed.type === "question") {
            await db.transaction(async (tx) => {
              assertActivityActive(sessionId, activity);
              const transactionalMessagesDao = createPipelineAgentMessagesDao(tx);
              const transactionalSessionsDao = createPipelineAgentSessionsDao(tx);
              await transactionalMessagesDao.create({
                id: crypto.randomUUID(),
                sessionId,
                role: "assistant",
                kind: "question",
                content: parsed.question,
              });
              assertActivityActive(sessionId, activity);
              await transactionalSessionsDao.update(sessionId, { status: "awaiting_user" });
              assertActivityActive(sessionId, activity);
            });

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
            const actionProposalResult = await runAbortable(
              pipelinesService.proposeActions({
                snapshot: session.snapshot,
                message: actionRequest,
                pipelineId: session.pipelineId ?? undefined,
                runtimeId: input?.runtimeId,
              }),
              activity.controller.signal,
              sessionId,
            );
            assertActivityActive(sessionId, activity);
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
              pendingOperations: actionProposalResult.pendingOperations ?? [],
            };
            const saved = await db.transaction(async (tx) => {
              assertActivityActive(sessionId, activity);
              const transactionalProposalsDao = createPipelineAgentProposalsDao(tx);
              const transactionalSessionsDao = createPipelineAgentSessionsDao(tx);
              const persistedProposal = await transactionalProposalsDao.create({
                id: crypto.randomUUID(),
                sessionId,
                mode: session.mode,
                status: "proposal_ready",
                proposal: finalEditProposal,
                approvedAt: null,
              });
              assertActivityActive(sessionId, activity);
              await transactionalSessionsDao.update(sessionId, {
                latestProposalId: persistedProposal.id,
                status: "proposal_ready",
              });
              assertActivityActive(sessionId, activity);

              return persistedProposal;
            });

            return {
              type: "proposal" as const,
              proposal: finalEditProposal,
              proposalId: saved.id,
            };
          }

          const generateProposal = parsed.proposal as Extract<
            PipelineAgentProposal,
            { mode: "generate" }
          >;
          const saved = await db.transaction(async (tx) => {
            assertActivityActive(sessionId, activity);
            const transactionalProposalsDao = createPipelineAgentProposalsDao(tx);
            const transactionalSessionsDao = createPipelineAgentSessionsDao(tx);
            const persistedProposal = await transactionalProposalsDao.create({
              id: crypto.randomUUID(),
              sessionId,
              mode: session.mode,
              status: "proposal_ready",
              proposal: generateProposal,
              approvedAt: null,
            });
            assertActivityActive(sessionId, activity);
            await transactionalSessionsDao.update(sessionId, {
              latestProposalId: persistedProposal.id,
              status: "proposal_ready",
            });
            assertActivityActive(sessionId, activity);

            return persistedProposal;
          });

          return {
            type: "proposal" as const,
            proposal: generateProposal,
            proposalId: saved.id,
          };
        })(),
        (error) => (error instanceof Error ? error : new Error(String(error))),
      );
      if (planningResult.isErr()) {
        await sessionsDao.update(sessionId, {
          status: isCancellationError(planningResult.error) ? "awaiting_user" : "failed",
        });
        input?.signal?.removeEventListener("abort", handleExternalAbort);
        finishActivity(sessionId, activity);
        throw planningResult.error;
      }

      input?.signal?.removeEventListener("abort", handleExternalAbort);
      finishActivity(sessionId, activity);

      return planningResult.value;
    },

    generatePipelineFromApprovedProposal: async (
      sessionId: string,
      input?: { runtimeId?: string; signal?: AbortSignal },
    ) => {
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
      if (proposalRecord.proposal.readiness !== "ready_for_generation") {
        throw new Error(
          `Approved generate proposal is not ready for generation in session ${sessionId}`,
        );
      }
      const generateProposal = proposalRecord.proposal;
      const activity = beginActivity(sessionId, "generating");
      const handleExternalAbort = () => activity.controller.abort();
      input?.signal?.addEventListener("abort", handleExternalAbort, { once: true });

      const preparationResult = await ResultAsync.fromPromise(
        (async () => {
          const [messages, artifacts, settings, runtimes] = await Promise.all([
            messagesDao.findManyBySessionId(sessionId),
            contextArtifactsDao.findManyBySessionId(sessionId),
            settingsDao.get(),
            agentRuntimesDao.findMany(),
          ]);
          assertActivityActive(sessionId, activity);
          const effectiveRuntime = resolveEffectiveRuntime({
            requestedRuntimeId: input?.runtimeId,
            runtimes,
            defaultRuntime: settings.defaultAgentRuntime ?? null,
          });
          if (!effectiveRuntime) {
            throw createRuntimeNotFoundError(input?.runtimeId);
          }
          const pipelineName = generateProposal.purpose;
          const pipelineDescription = [
            buildGenerationDescription(generateProposal),
            "Conversation context:",
            messages
              .map((message) => `[${message.role}/${message.kind}] ${message.content}`)
              .join("\n") || "(none)",
            "",
            "Attachment context:",
            buildArtifactSummary(artifacts),
          ].join("\n\n");

          await sessionsDao.update(sessionId, { status: "generating" });
          assertActivityActive(sessionId, activity);

          return { effectiveRuntime, pipelineDescription, pipelineName };
        })(),
        (error) => (error instanceof Error ? error : new Error(String(error))),
      );
      if (preparationResult.isErr()) {
        await proposalsDao.update(proposalRecord.id, {
          status: "proposal_ready",
          approvedAt: null,
        });
        await sessionsDao.update(sessionId, {
          status: "proposal_ready",
          latestProposalId: proposalRecord.id,
          approvedProposalId: null,
          createdPipelineId: null,
        });
        input?.signal?.removeEventListener("abort", handleExternalAbort);
        finishActivity(sessionId, activity);
        throw preparationResult.error;
      }
      const { effectiveRuntime, pipelineDescription, pipelineName } = preparationResult.value;

      const persistedPipeline = { id: null as string | null };
      const pendingOperationIds = { value: [] as string[] };
      const generationResult = await ResultAsync.fromPromise(
        (async () => {
          assertActivityActive(sessionId, activity);
          const analysis = await runAbortable(
            pipelinesService.analyzeIntent({
              name: pipelineName,
              description: pipelineDescription,
              runtimeType: effectiveRuntime,
            }),
            activity.controller.signal,
            sessionId,
          );
          assertActivityActive(sessionId, activity);
          const generated = await runAbortable(
            pipelinesService.generateStructure({
              name: pipelineName,
              description: pipelineDescription,
              matchedOperations: analysis.matchedOperations,
              unmatchedSteps: analysis.unmatchedSteps,
              runtimeType: effectiveRuntime,
            }),
            activity.controller.signal,
            sessionId,
          );
          assertActivityActive(sessionId, activity);
          if ("error" in generated) {
            throw new Error(generated.error);
          }
          pendingOperationIds.value =
            generated.pendingOperations?.map((operation) => operation.id) ?? [];

          const pipeline = await db.transaction(async (tx) => {
            const transactionalPipelinesService = createPipelinesService(
              tx as unknown as DbConnection,
            );
            const transactionalRoutinesDao = createRoutinesDao(tx as unknown as DbConnection);
            const transactionalSessionsDao = createPipelineAgentSessionsDao(tx);
            assertActivityActive(sessionId, activity);
            if (generated.pendingOperations && generated.pendingOperations.length > 0) {
              await transactionalPipelinesService.createPendingOperations(
                generated.pendingOperations,
              );
              assertActivityActive(sessionId, activity);
            }

            const createdPipeline = await transactionalPipelinesService.create({
              id: crypto.randomUUID(),
              name: pipelineName,
              description: pipelineDescription,
              tags: ["agent-generated"],
              timeoutMs: null,
              nodes: generated.nodes,
              edges: generated.edges,
            });
            assertActivityActive(sessionId, activity);
            if (generateProposal.schedule) {
              const enabled = generateProposal.schedule.enabled;
              const nextRunAt = enabled
                ? getNextCronRunAt(generateProposal.schedule.cronExpression, new Date())
                : null;
              if (enabled && !nextRunAt) {
                throw new Error("Agent returned an invalid Pipeline schedule");
              }
              await transactionalRoutinesDao.create({
                id: crypto.randomUUID(),
                pipelineId: createdPipeline.id,
                name: generateProposal.schedule.name ?? `${pipelineName} schedule`,
                description: `Agent-created schedule for ${pipelineName}`,
                cronExpression: generateProposal.schedule.cronExpression,
                inputConfig: null,
                enabled,
                lastRunAt: null,
                nextRunAt,
              });
              assertActivityActive(sessionId, activity);
            }
            await transactionalSessionsDao.update(sessionId, {
              status: "completed",
              createdPipelineId: createdPipeline.id,
            });
            assertActivityActive(sessionId, activity);

            return createdPipeline;
          });
          persistedPipeline.id = pipeline.id;
          assertActivityActive(sessionId, activity);

          return pipeline;
        })(),
        (error) => (error instanceof Error ? error : new Error(String(error))),
      );
      if (generationResult.isErr()) {
        if (isCancellationError(generationResult.error) && persistedPipeline.id) {
          await ResultAsync.fromPromise(
            Promise.all([
              pipelinesService.delete(persistedPipeline.id),
              ...pendingOperationIds.value.map((operationId) => operationsDao.delete(operationId)),
            ]),
            (error) => (error instanceof Error ? error : new Error(String(error))),
          );
        }
        await proposalsDao.update(proposalRecord.id, {
          status: "proposal_ready",
          approvedAt: null,
        });
        await sessionsDao.update(sessionId, {
          status: "proposal_ready",
          latestProposalId: proposalRecord.id,
          approvedProposalId: null,
          createdPipelineId: null,
        });
        input?.signal?.removeEventListener("abort", handleExternalAbort);
        finishActivity(sessionId, activity);
        throw generationResult.error;
      }

      const pipeline = generationResult.value;
      input?.signal?.removeEventListener("abort", handleExternalAbort);
      finishActivity(sessionId, activity);

      return { pipeline };
    },
  };
};

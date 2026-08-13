import { Result } from "neverthrow";
import { z } from "zod/v4";
import {
  OperationSchema,
  PipelineSchema,
  PipelineAgentAttachmentParseStatusSchema,
  PipelineAgentEntrypointSchema,
  PipelineAgentMessageKindSchema,
  PipelineAgentMessageRoleSchema,
  PipelineAgentModeSchema,
  PipelineAgentProposalSchema,
  PipelineAgentProposalStatusSchema,
  PipelineAgentSessionStatusSchema,
  type PipelineAgentEntrypoint,
  type PipelineAgentMessageKind,
  type PipelineAgentMessageRole,
  type PipelineAgentMode,
  type PipelineAgentProposal,
  type Operation,
  type PipelineData,
} from "@repo/schemas";
import { resolveApiBaseUrl } from "./resolveApiBaseUrl";

const pipelineAgentApiBaseUrl = resolveApiBaseUrl(
  globalThis.window === undefined ? undefined : globalThis.window.location,
);
const pipelineAgentSessionsBaseUrl = `${pipelineAgentApiBaseUrl}/pipeline-agent-sessions`;

interface PipelineAgentRequestOptions {
  signal?: AbortSignal;
}

interface PipelineAgentRuntimeRequestOptions extends PipelineAgentRequestOptions {
  runtimeId?: string | null;
}

const PipelineAgentOperationSchema = OperationSchema.extend({
  sourceSkillId: z.string().nullish(),
});

const PipelineAgentSessionClientRecordSchema = z.object({
  id: z.string().min(1),
  entrypoint: PipelineAgentEntrypointSchema,
  mode: PipelineAgentModeSchema,
  status: PipelineAgentSessionStatusSchema,
  latestProposalId: z.string().nullable().optional(),
});
export type PipelineAgentSessionClientRecord = z.infer<
  typeof PipelineAgentSessionClientRecordSchema
>;

const PipelineAgentAttachmentClientRecordSchema = z.object({
  id: z.string().min(1),
  filename: z.string().min(1),
  parseError: z.string().nullable().optional(),
  parseStatus: PipelineAgentAttachmentParseStatusSchema.nullable().optional(),
});
export type PipelineAgentAttachmentClientRecord = z.infer<
  typeof PipelineAgentAttachmentClientRecordSchema
>;

const PipelineAgentAttachmentUploadResultSchema = z.object({
  attachment: PipelineAgentAttachmentClientRecordSchema.optional(),
});
export type PipelineAgentAttachmentUploadResult = z.infer<
  typeof PipelineAgentAttachmentUploadResultSchema
>;

const PipelineAgentMessageClientRecordSchema = z.object({
  id: z.string().min(1),
  role: PipelineAgentMessageRoleSchema,
  kind: PipelineAgentMessageKindSchema,
  content: z.string(),
});
export type PipelineAgentMessageClientRecord = z.infer<
  typeof PipelineAgentMessageClientRecordSchema
>;

const PipelineAgentStoredProposalClientRecordSchema = z.object({
  id: z.string().min(1),
  mode: PipelineAgentModeSchema,
  status: PipelineAgentProposalStatusSchema,
  proposal: PipelineAgentProposalSchema,
});
export type PipelineAgentStoredProposalClientRecord = z.infer<
  typeof PipelineAgentStoredProposalClientRecordSchema
>;

const PipelineAgentSessionClientDetailSchema = PipelineAgentSessionClientRecordSchema.extend({
  attachments: z.array(PipelineAgentAttachmentClientRecordSchema).optional(),
  createdPipelineId: z.string().nullable().optional(),
  messages: z.array(PipelineAgentMessageClientRecordSchema).optional(),
  proposals: z.array(PipelineAgentStoredProposalClientRecordSchema).optional(),
});
export type PipelineAgentSessionClientDetail = z.infer<
  typeof PipelineAgentSessionClientDetailSchema
>;

const PipelineAgentPlanEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("phase"), phase: z.string().min(1) }),
  z.object({ type: z.literal("progress"), message: z.string() }),
  z.object({ type: z.literal("assistant_chunk"), text: z.string() }),
  z.object({ type: z.literal("question"), question: z.string().min(1) }),
  z.object({
    type: z.literal("proposal_ready"),
    proposal: PipelineAgentProposalSchema,
    proposalId: z.string().min(1),
  }),
  z.object({ type: z.literal("done"), status: z.string().min(1) }),
  z.object({ type: z.literal("error"), code: z.string().optional(), message: z.string() }),
]);
export type PipelineAgentPlanEvent = z.infer<typeof PipelineAgentPlanEventSchema>;

const PipelineAgentCreatedPipelineResponseSchema = z.object({
  pipelineId: z.string().min(1),
});

const parsePlanEvent = (value: unknown): PipelineAgentPlanEvent | null => {
  const result = PipelineAgentPlanEventSchema.safeParse(value);

  return result.success ? result.data : null;
};

const parseEventPayload = (raw: string): Record<string, unknown> | null =>
  Result.fromThrowable(
    () => JSON.parse(raw) as Record<string, unknown>,
    () => null,
  )().unwrapOr(null);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const readResponseError = async (response: Response) => {
  const body = await response.text();
  const parsed = parseEventPayload(body);
  const message =
    isRecord(parsed) && typeof parsed.error === "string"
      ? parsed.error
      : body || `Request failed with status ${response.status}`;

  const error = new Error(message) as Error & { code?: string; status: number };
  if (isRecord(parsed) && typeof parsed.code === "string") {
    error.code = parsed.code;
  }
  error.status = response.status;

  return error;
};

const readResponseJson = async <T>(response: Response, schema: z.ZodType<T>): Promise<T> => {
  const body = await response.text();
  if (!response.ok) {
    throw await readResponseError(new Response(body, { status: response.status }));
  }

  return schema.parse(JSON.parse(body));
};

const parseSseMessage = (message: string): PipelineAgentPlanEvent | null => {
  const lines = message
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const eventLine = lines.find((line) => line.startsWith("event:"));
  const dataLines = lines.filter((line) => line.startsWith("data:"));
  if (dataLines.length === 0) {
    return null;
  }

  const eventName = eventLine?.slice(6).trim() ?? "";
  const parsed = parseEventPayload(dataLines.map((line) => line.slice(5).trimStart()).join("\n"));

  if (!parsed || !isRecord(parsed)) {
    return null;
  }

  switch (eventName) {
    case "phase": {
      return parsePlanEvent({
        type: "phase",
        phase: parsed.phase,
      });
    }
    case "progress": {
      return parsePlanEvent({
        type: "progress",
        message: parsed.message,
      });
    }
    case "assistant_chunk": {
      return parsePlanEvent({
        type: "assistant_chunk",
        text: parsed.text,
      });
    }
    case "question": {
      return parsePlanEvent({
        type: "question",
        question: parsed.question,
      });
    }
    case "proposal_ready": {
      return parsePlanEvent({
        type: "proposal_ready",
        proposal: parsed.proposal,
        proposalId: parsed.proposalId,
      });
    }
    case "done": {
      return parsePlanEvent({
        type: "done",
        status: parsed.status,
      });
    }
    case "error": {
      return parsePlanEvent({
        type: "error",
        code: parsed.code,
        message: parsed.message,
      });
    }
    default: {
      return parsePlanEvent(parsed);
    }
  }
};

export const pipelineAgentSessionsClient = {
  async createSession(
    input: {
      entrypoint: PipelineAgentEntrypoint;
      mode: PipelineAgentMode;
      pipelineId?: string;
      snapshot?: unknown;
    },
    options?: PipelineAgentRequestOptions,
  ): Promise<PipelineAgentSessionClientRecord> {
    const response = await fetch(pipelineAgentSessionsBaseUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      signal: options?.signal,
    });

    return readResponseJson(response, PipelineAgentSessionClientRecordSchema);
  },

  async appendMessage(
    sessionId: string,
    input: { role: PipelineAgentMessageRole; kind: PipelineAgentMessageKind; content: string },
    options?: PipelineAgentRequestOptions,
  ): Promise<PipelineAgentMessageClientRecord> {
    const response = await fetch(`${pipelineAgentSessionsBaseUrl}/${sessionId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      signal: options?.signal,
    });

    return readResponseJson(response, PipelineAgentMessageClientRecordSchema);
  },

  async uploadAttachment(
    sessionId: string,
    file: File,
    input?: { runtimeId?: string | null; signal?: AbortSignal },
  ): Promise<PipelineAgentAttachmentUploadResult> {
    const formData = new FormData();
    formData.append("file", file);
    if (input?.runtimeId) {
      formData.append("runtimeId", input.runtimeId);
    }

    const response = await fetch(`${pipelineAgentSessionsBaseUrl}/${sessionId}/attachments`, {
      method: "POST",
      body: formData,
      signal: input?.signal,
    });

    return readResponseJson(response, PipelineAgentAttachmentUploadResultSchema);
  },

  async removeAttachment(
    sessionId: string,
    attachmentId: string,
    options?: PipelineAgentRequestOptions,
  ): Promise<void> {
    const response = await fetch(
      `${pipelineAgentSessionsBaseUrl}/${sessionId}/attachments/${attachmentId}`,
      { method: "DELETE", signal: options?.signal },
    );
    if (!response.ok) {
      throw await readResponseError(response);
    }
  },

  async getSessionById(
    sessionId: string,
    options?: PipelineAgentRequestOptions,
  ): Promise<PipelineAgentSessionClientDetail> {
    const response = await fetch(`${pipelineAgentSessionsBaseUrl}/${sessionId}`, {
      signal: options?.signal,
    });

    return readResponseJson(response, PipelineAgentSessionClientDetailSchema);
  },

  async getLatestReadyProposal(
    sessionId: string,
    mode: PipelineAgentMode,
    input?: { excludeProposalId?: string | null; signal?: AbortSignal },
  ): Promise<{ proposal: PipelineAgentProposal; proposalId: string } | null> {
    const session = await this.getSessionById(sessionId, { signal: input?.signal });
    const proposals = session.proposals ?? [];
    const latestProposal =
      proposals.find((proposal) => proposal.id === session.latestProposalId) ??
      proposals.at(-1) ??
      null;

    if (
      !latestProposal ||
      latestProposal.id === input?.excludeProposalId ||
      latestProposal.mode !== mode ||
      latestProposal.status !== "proposal_ready"
    ) {
      return null;
    }

    return {
      proposal: latestProposal.proposal,
      proposalId: latestProposal.id,
    };
  },

  async getLatestAssistantQuestion(
    sessionId: string,
    options?: PipelineAgentRequestOptions,
  ): Promise<{ question: string } | null> {
    const session = await this.getSessionById(sessionId, options);
    const latestQuestion =
      [...(session.messages ?? [])]
        .reverse()
        .find((message) => message.role === "assistant" && message.kind === "question") ?? null;

    return latestQuestion ? { question: latestQuestion.content } : null;
  },

  async approveProposal(
    sessionId: string,
    proposalId: string,
    options?: PipelineAgentRequestOptions,
  ) {
    const response = await fetch(`${pipelineAgentSessionsBaseUrl}/${sessionId}/approve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ proposalId }),
      signal: options?.signal,
    });
    if (!response.ok) {
      throw await readResponseError(response);
    }
  },

  async supersedeProposal(
    sessionId: string,
    proposalId: string,
    options?: PipelineAgentRequestOptions,
  ) {
    const response = await fetch(`${pipelineAgentSessionsBaseUrl}/${sessionId}/supersede`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ proposalId }),
      signal: options?.signal,
    });
    if (!response.ok) {
      throw await readResponseError(response);
    }
  },

  async generatePipelineFromApprovedProposal(
    sessionId: string,
    options?: PipelineAgentRuntimeRequestOptions,
  ): Promise<{ pipelineId: string }> {
    const response = await fetch(`${pipelineAgentSessionsBaseUrl}/${sessionId}/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(options?.runtimeId ? { runtimeId: options.runtimeId } : {}),
      signal: options?.signal,
    });

    return readResponseJson(response, PipelineAgentCreatedPipelineResponseSchema);
  },

  async getGeneratedPipelineMaterialization(
    pipelineId: string,
    options?: PipelineAgentRequestOptions,
  ): Promise<{ operations: Operation[]; pipeline: PipelineData }> {
    const pipelineResponse = await fetch(
      `${pipelineAgentApiBaseUrl}/pipelines/${encodeURIComponent(pipelineId)}`,
      { signal: options?.signal },
    );
    const pipeline = await readResponseJson(pipelineResponse, PipelineSchema);
    const operationIds = [
      ...new Set(
        pipeline.nodes.flatMap((node) => {
          const operationId = "operationId" in node.data ? node.data.operationId : undefined;

          return typeof operationId === "string" && operationId.length > 0 ? [operationId] : [];
        }),
      ),
    ];
    const operations = await Promise.all(
      operationIds.map(async (operationId) => {
        const response = await fetch(
          `${pipelineAgentApiBaseUrl}/operations/${encodeURIComponent(operationId)}`,
          { signal: options?.signal },
        );
        const operation = await readResponseJson(response, PipelineAgentOperationSchema);

        return {
          ...operation,
          sourceSkillId: operation.sourceSkillId ?? undefined,
        };
      }),
    );

    return { operations, pipeline };
  },

  async waitForCreatedPipeline(
    sessionId: string,
    input?: { intervalMs?: number; signal?: AbortSignal; timeoutMs?: number },
  ): Promise<{ pipelineId: string }> {
    const intervalMs = input?.intervalMs ?? 1000;
    const timeoutMs = input?.timeoutMs ?? 6 * 60 * 1000;
    const startedAt = Date.now();
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        if (input?.signal?.aborted) {
          resolve();

          return;
        }

        const handleAbort = () => {
          globalThis.clearTimeout(timeoutId);
          resolve();
        };
        const timeoutId = globalThis.setTimeout(() => {
          input?.signal?.removeEventListener("abort", handleAbort);
          resolve();
        }, ms);
        input?.signal?.addEventListener("abort", handleAbort, { once: true });
      });

    while (Date.now() - startedAt < timeoutMs) {
      if (input?.signal?.aborted) {
        throw new Error(`Stopped waiting for generated pipeline in session ${sessionId}`);
      }

      const session = await this.getSessionById(sessionId, { signal: input?.signal });
      if (session.status === "completed" && session.createdPipelineId) {
        return { pipelineId: session.createdPipelineId };
      }

      await wait(intervalMs);
    }

    throw new Error(`Timed out waiting for generated pipeline in session ${sessionId}`);
  },

  async planSessionStream(
    sessionId: string,
    input: {
      runtimeId?: string;
      signal?: AbortSignal;
      onEvent: (event: PipelineAgentPlanEvent) => void;
    },
  ) {
    const response = await fetch(`${pipelineAgentSessionsBaseUrl}/${sessionId}/plan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input.runtimeId ? { runtimeId: input.runtimeId } : {}),
      signal: input.signal,
    });
    if (!response.ok) {
      throw await readResponseError(response);
    }
    const reader = response.body?.getReader();
    if (!reader) {
      return;
    }

    const decoder = new TextDecoder();
    const streamState = { buffer: "" };
    const emitBufferedMessages = () => {
      const messages = streamState.buffer.split(/\r?\n\r?\n/);
      streamState.buffer = messages.pop() ?? "";

      for (const message of messages) {
        const parsed = parseSseMessage(message);
        if (parsed) {
          input.onEvent(parsed);
        }
      }
    };

    while (true) {
      const chunk = await reader.read();
      if (chunk.done) {
        streamState.buffer += decoder.decode();
        emitBufferedMessages();
        const trailingMessage = streamState.buffer.trim();
        if (trailingMessage.length > 0) {
          const parsed = parseSseMessage(trailingMessage);
          if (parsed) {
            input.onEvent(parsed);
          }
        }
        break;
      }

      streamState.buffer += decoder.decode(chunk.value, { stream: true });
      emitBufferedMessages();
    }
  },

  async cancelSession(sessionId: string, options?: PipelineAgentRequestOptions): Promise<void> {
    const response = await fetch(`${pipelineAgentSessionsBaseUrl}/${sessionId}/cancel`, {
      method: "POST",
      signal: options?.signal,
    });
    if (!response.ok) {
      throw await readResponseError(response);
    }
  },
};

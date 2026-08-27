import { Result } from "neverthrow";
import { z } from "zod/v4";
import type { PlatformCapabilities } from "../platform";
import { projectPipelineAgentMessage } from "./projectPipelineAgentMessage";
import { consumeAgentRunEventStream } from "./agentRunEventsClient";
import {
  AgentRunSchema,
  OperationSchema,
  PipelineSchema,
  PipelineAgentAttachmentParseStatusSchema,
  PipelineAgentEntrypointSchema,
  PipelineAgentMessageKindSchema,
  PipelineAgentMessageRoleSchema,
  PipelineAgentModeSchema,
  PipelineAgentProposalSchema,
  PipelineGraphSnapshotSchema,
  PipelineAgentProposalStatusSchema,
  PipelineAgentSessionStatusSchema,
  type Operation,
  type PipelineData,
  type PipelineAgentEntrypoint,
  type PipelineAgentMessageKind,
  type PipelineAgentMessageRole,
  type PipelineAgentMode,
  type PipelineAgentProposal,
  type AgentRunEventEnvelope,
} from "@repo/schemas";

interface PipelineAgentRequestOptions {
  signal?: AbortSignal;
}

const PipelineAgentOperationSchema = OperationSchema.extend({
  sourceSkillId: z.string().nullish(),
});

const PipelineAgentSessionClientRecordSchema = z.object({
  id: z.string().min(1),
  entrypoint: PipelineAgentEntrypointSchema,
  mode: PipelineAgentModeSchema,
  status: PipelineAgentSessionStatusSchema,
  pipelineId: z.string().nullable().optional(),
  snapshot: PipelineGraphSnapshotSchema.nullable().optional(),
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
  z.object({ type: z.literal("thinking"), text: z.string() }),
  z.object({
    type: z.literal("tool"),
    phase: z.enum(["start", "update", "result"]),
    id: z.string().min(1),
    name: z.string().optional(),
    status: z.string().optional(),
    output: z.unknown().optional(),
  }),
  z.object({
    type: z.literal("diagnostic"),
    level: z.enum(["info", "warning", "error"]),
    code: z.string().min(1),
    message: z.string().min(1),
  }),
  z.object({
    type: z.literal("retry"),
    phase: z.enum(["starting", "succeeded", "failed", "exhausted"]),
    attempt: z.number().int().positive().optional(),
    message: z.string().optional(),
  }),
  z.object({
    type: z.literal("usage"),
    inputTokens: z.number().int().nonnegative().optional(),
    outputTokens: z.number().int().nonnegative().optional(),
    cachedInputTokens: z.number().int().nonnegative().optional(),
    costUsd: z.number().nonnegative().optional(),
  }),
  z.object({
    type: z.literal("terminal"),
    status: z.enum(["completed", "failed", "cancelled", "timed_out", "interrupted"]),
  }),
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

const AgentRunStartResponseSchema = z.object({ runId: z.string().min(1) });
const ActiveAgentRunSchema = z.object({
  runId: z.string().min(1),
  lastSequence: z.number().int().nonnegative(),
});
const terminalRunStatuses = [
  "completed",
  "failed",
  "cancelled",
  "timed_out",
  "interrupted",
] as const;
type TerminalRunStatus = (typeof terminalRunStatuses)[number];
const PIPELINE_AGENT_PROJECTION_POLL_INTERVAL_MS = 500;
const PIPELINE_AGENT_PROJECTION_TIMEOUT_MS = 10 * 60 * 1000;
const isTerminalRunStatus = (
  status: z.infer<typeof AgentRunSchema>["status"],
): status is TerminalRunStatus => terminalRunStatuses.includes(status as TerminalRunStatus);

const activeAgentRunStorageKey = (sessionId: string) =>
  `ordine.pipeline-agent.active-run.${sessionId}`;
const readActiveAgentRun = (sessionId: string) => {
  if (globalThis.window === undefined) return null;
  const raw = globalThis.window.localStorage.getItem(activeAgentRunStorageKey(sessionId));
  if (!raw) return null;
  const parsed = Result.fromThrowable(
    () => ActiveAgentRunSchema.parse(JSON.parse(raw)),
    () => null,
  )();

  return parsed.unwrapOr(null);
};
const writeActiveAgentRun = (sessionId: string, runId: string, lastSequence: number) => {
  if (globalThis.window === undefined) return;
  globalThis.window.localStorage.setItem(
    activeAgentRunStorageKey(sessionId),
    JSON.stringify({ runId, lastSequence }),
  );
};
const clearActiveAgentRun = (sessionId: string) => {
  if (globalThis.window === undefined) return;
  globalThis.window.localStorage.removeItem(activeAgentRunStorageKey(sessionId));
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

const mapAgentRunEvent = (envelope: AgentRunEventEnvelope): PipelineAgentPlanEvent | null => {
  const event = envelope.event;
  if (event.type === "message") {
    const projected = projectPipelineAgentMessage(event.text);
    if (projected !== undefined) return projected;

    return { type: "assistant_chunk", text: event.text };
  }
  if (event.type === "text_delta") {
    return { type: "assistant_chunk", text: event.text };
  }
  if (event.type === "thinking_delta") return { type: "thinking", text: event.text };
  if (event.type === "tool_start") {
    return { type: "tool", phase: "start", id: event.id, name: event.name };
  }
  if (event.type === "tool_update") {
    return {
      type: "tool",
      phase: "update",
      id: event.id,
      name: event.name,
      status: event.status,
      output: event.output,
    };
  }
  if (event.type === "tool_result") {
    return {
      type: "tool",
      phase: "result",
      id: event.id,
      status: event.isError ? "failed" : "completed",
      output: event.output,
    };
  }
  if (event.type === "diagnostic") {
    return {
      type: "diagnostic",
      level: event.level,
      code: event.code,
      message: event.message,
    };
  }
  if (event.type === "retry") {
    return {
      type: "retry",
      phase: event.phase,
      attempt: event.attempt,
      message: event.message,
    };
  }
  if (event.type === "usage") {
    return {
      type: "usage",
      inputTokens: event.inputTokens,
      outputTokens: event.outputTokens,
      cachedInputTokens: event.cachedInputTokens,
      costUsd: event.costUsd,
    };
  }
  if (event.type === "terminal") return { type: "terminal", status: event.status };
  if (event.type === "status") {
    return { type: "progress", message: event.message ?? event.phase };
  }

  return null;
};

type PipelineAgentSessionsTransport = Pick<PlatformCapabilities, "apiBaseUrl" | "request">;

export const createPipelineAgentSessionsClient = (platform: PipelineAgentSessionsTransport) => {
  const pipelineAgentSessionsBaseUrl = `${platform.apiBaseUrl}/pipeline-agent-sessions`;
  const agentRunsBaseUrl = `${platform.apiBaseUrl}/agent-runs`;

  return {
    async createSession(
      input: {
        entrypoint: PipelineAgentEntrypoint;
        mode: PipelineAgentMode;
        pipelineId?: string;
        snapshot?: unknown;
      },
      options?: PipelineAgentRequestOptions,
    ): Promise<PipelineAgentSessionClientRecord> {
      const response = await platform.request(pipelineAgentSessionsBaseUrl, {
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
      const response = await platform.request(
        `${pipelineAgentSessionsBaseUrl}/${sessionId}/messages`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
          signal: options?.signal,
        },
      );

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

      const response = await platform.request(
        `${pipelineAgentSessionsBaseUrl}/${sessionId}/attachments`,
        {
          method: "POST",
          body: formData,
          signal: input?.signal,
        },
      );

      return readResponseJson(response, PipelineAgentAttachmentUploadResultSchema);
    },

    async removeAttachment(
      sessionId: string,
      attachmentId: string,
      options?: PipelineAgentRequestOptions,
    ): Promise<void> {
      const response = await platform.request(
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
      const response = await platform.request(`${pipelineAgentSessionsBaseUrl}/${sessionId}`, {
        signal: options?.signal,
      });

      return readResponseJson(response, PipelineAgentSessionClientDetailSchema);
    },

    async getLatestSessionForPipeline(
      pipelineId: string,
    ): Promise<PipelineAgentSessionClientRecord | null> {
      const response = await platform.request(
        `${pipelineAgentSessionsBaseUrl}?pipelineId=${encodeURIComponent(pipelineId)}`,
      );
      if (response.status === 404) return null;

      return readResponseJson(response, PipelineAgentSessionClientRecordSchema);
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
      const response = await platform.request(
        `${pipelineAgentSessionsBaseUrl}/${sessionId}/approve`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ proposalId }),
          signal: options?.signal,
        },
      );
      if (!response.ok) {
        throw await readResponseError(response);
      }
    },

    async supersedeProposal(
      sessionId: string,
      proposalId: string,
      options?: PipelineAgentRequestOptions,
    ) {
      const response = await platform.request(
        `${pipelineAgentSessionsBaseUrl}/${sessionId}/supersede`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ proposalId }),
          signal: options?.signal,
        },
      );
      if (!response.ok) {
        throw await readResponseError(response);
      }
    },

    async generatePipelineFromApprovedProposal(
      sessionId: string,
      input?: { runtimeId?: string | null; signal?: AbortSignal },
    ): Promise<{ pipelineId: string }> {
      const response = await platform.request(
        `${pipelineAgentSessionsBaseUrl}/${sessionId}/generate`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input?.runtimeId ? { runtimeId: input.runtimeId } : {}),
          signal: input?.signal,
        },
      );

      return readResponseJson(response, PipelineAgentCreatedPipelineResponseSchema);
    },

    async getGeneratedPipelineMaterialization(
      pipelineId: string,
      options?: PipelineAgentRequestOptions,
    ): Promise<{ operations: Operation[]; pipeline: PipelineData }> {
      const pipelineResponse = await platform.request(
        `${platform.apiBaseUrl}/pipelines/${encodeURIComponent(pipelineId)}`,
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
          const response = await platform.request(
            `${platform.apiBaseUrl}/operations/${encodeURIComponent(operationId)}`,
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

        const session = await this.getSessionById(sessionId);
        if (session.status === "completed" && session.createdPipelineId) {
          return { pipelineId: session.createdPipelineId };
        }

        await wait(intervalMs);
      }

      throw new Error(`Timed out waiting for generated pipeline in session ${sessionId}`);
    },

    async cancelActiveRun(sessionId: string): Promise<boolean> {
      const activeRun = readActiveAgentRun(sessionId);
      const sessionResponse = await platform.request(
        `${pipelineAgentSessionsBaseUrl}/${encodeURIComponent(sessionId)}/cancel`,
        { method: "POST" },
      );
      if (!sessionResponse.ok) throw await readResponseError(sessionResponse);
      if (!activeRun) return true;

      const response = await platform.request(
        `${agentRunsBaseUrl}/${encodeURIComponent(activeRun.runId)}/cancel`,
        { method: "POST" },
      );
      if (!response.ok) throw await readResponseError(response);
      clearActiveAgentRun(sessionId);

      return true;
    },

    async cancelSession(sessionId: string, options?: PipelineAgentRequestOptions): Promise<void> {
      const response = await platform.request(
        `${pipelineAgentSessionsBaseUrl}/${sessionId}/cancel`,
        { method: "POST", signal: options?.signal },
      );
      if (!response.ok) {
        throw await readResponseError(response);
      }
    },

    async planSessionStream(
      sessionId: string,
      input: {
        runtimeId?: string;
        model?: string;
        reasoningEffort?: string;
        speed?: string;
        firstOutputTimeoutSeconds?: number;
        signal?: AbortSignal;
        onEvent: (event: PipelineAgentPlanEvent) => void;
      },
    ) {
      const storedRun = readActiveAgentRun(sessionId);
      const activeRunState = {
        runId: storedRun?.runId ?? null,
        lastSequence: storedRun?.lastSequence ?? 0,
      };

      if (activeRunState.runId) {
        const storedResponse = await platform.request(
          `${agentRunsBaseUrl}/${encodeURIComponent(activeRunState.runId)}`,
          { signal: input.signal },
        );
        const stored = storedResponse.ok
          ? await readResponseJson(storedResponse, AgentRunSchema)
          : null;
        if (!stored || isTerminalRunStatus(stored.status)) {
          clearActiveAgentRun(sessionId);
          activeRunState.runId = null;
          activeRunState.lastSequence = 0;
        }
      }

      if (!activeRunState.runId) {
        const startResponse = await platform.request(
          `${pipelineAgentSessionsBaseUrl}/${sessionId}/runs`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              ...(input.runtimeId ? { runtimeId: input.runtimeId } : {}),
              ...(input.model ? { model: input.model } : {}),
              ...(input.reasoningEffort ? { reasoningEffort: input.reasoningEffort } : {}),
              ...(input.speed ? { speed: input.speed } : {}),
              ...(input.firstOutputTimeoutSeconds === undefined
                ? {}
                : { firstOutputTimeoutSeconds: input.firstOutputTimeoutSeconds }),
            }),
            signal: input.signal,
          },
        );
        const started = await readResponseJson(startResponse, AgentRunStartResponseSchema);
        activeRunState.runId = started.runId;
        writeActiveAgentRun(sessionId, activeRunState.runId, 0);
      }
      const runId = activeRunState.runId;
      if (!runId) throw new Error(`Agent run did not start for session ${sessionId}`);
      const streamControl = {
        lastSequence: activeRunState.lastSequence,
        terminalStatus: null as z.infer<typeof AgentRunSchema>["status"] | null,
      };

      input.onEvent({
        type: "phase",
        phase: streamControl.lastSequence > 0 ? "reconnecting" : "analyzing",
      });

      while (!streamControl.terminalStatus && !input.signal?.aborted) {
        const consumed = await consumeAgentRunEventStream(platform, {
          runId,
          after: streamControl.lastSequence,
          signal: input.signal,
          onEnvelope: (envelope) => {
            writeActiveAgentRun(sessionId, runId, envelope.sequence);
            const event = mapAgentRunEvent(envelope);
            if (event) input.onEvent(event);
          },
        });
        streamControl.lastSequence = consumed.lastSequence;
        streamControl.terminalStatus = consumed.terminalStatus;

        if (!streamControl.terminalStatus && !input.signal?.aborted) {
          const runResponse = await platform.request(
            `${agentRunsBaseUrl}/${encodeURIComponent(runId)}`,
            { signal: input.signal },
          );
          const run = await readResponseJson(runResponse, AgentRunSchema);
          if (isTerminalRunStatus(run.status)) {
            streamControl.terminalStatus = run.status;
            input.onEvent({ type: "terminal", status: run.status });
          }
        }
      }

      if (input.signal?.aborted) return;
      clearActiveAgentRun(sessionId);
      if (streamControl.terminalStatus !== "completed") {
        const runResponse = await platform.request(
          `${agentRunsBaseUrl}/${encodeURIComponent(runId)}`,
          { signal: input.signal },
        );
        const run = await readResponseJson(runResponse, AgentRunSchema);
        input.onEvent({
          type: "error",
          code: run.errorCode ?? streamControl.terminalStatus ?? "AGENT_RUN_FAILED",
          message:
            run.errorMessage ?? `Agent run ended with status ${streamControl.terminalStatus}`,
        });

        return;
      }

      input.onEvent({ type: "phase", phase: "finalizing" });
      const projectionStartedAt = Date.now();
      const streamedProjectionRunIds = new Set<string>();
      const streamProjectionRun = async (projectionRunId: string) => {
        await consumeAgentRunEventStream(platform, {
          runId: projectionRunId,
          signal: input.signal,
          onEnvelope: (envelope) => {
            const event = mapAgentRunEvent(envelope);
            if (event && event.type !== "assistant_chunk") input.onEvent(event);
          },
        });
      };
      while (Date.now() - projectionStartedAt < PIPELINE_AGENT_PROJECTION_TIMEOUT_MS) {
        const projectionRunResponse = await platform.request(
          `${pipelineAgentSessionsBaseUrl}/${encodeURIComponent(sessionId)}/projection-run?afterRunId=${encodeURIComponent(runId)}`,
          { signal: input.signal },
        );
        if (projectionRunResponse.ok && projectionRunResponse.status !== 204) {
          const projectionRun = await readResponseJson(projectionRunResponse, AgentRunSchema);
          if (!streamedProjectionRunIds.has(projectionRun.id)) {
            streamedProjectionRunIds.add(projectionRun.id);
            await streamProjectionRun(projectionRun.id);
          }
        } else if (!projectionRunResponse.ok) {
          throw await readResponseError(projectionRunResponse);
        }
        const session = await this.getSessionById(sessionId);
        const proposal =
          (session.proposals ?? []).find(
            (candidate) => candidate.id === session.latestProposalId,
          ) ??
          (session.proposals ?? []).at(-1) ??
          null;
        const question = [...(session.messages ?? [])]
          .reverse()
          .find((message) => message.role === "assistant" && message.kind === "question");
        if (proposal?.status === "proposal_ready") {
          input.onEvent({
            type: "proposal_ready",
            proposal: proposal.proposal,
            proposalId: proposal.id,
          });
          input.onEvent({ type: "done", status: "proposal_ready" });

          return;
        }
        if (question) {
          input.onEvent({ type: "question", question: question.content });
          input.onEvent({ type: "done", status: "awaiting_user" });

          return;
        }
        if (session.status === "failed") {
          input.onEvent({
            type: "error",
            code: "PIPELINE_AGENT_PROJECTION_FAILED",
            message: "Pipeline planning failed while finalizing the proposal.",
          });

          return;
        }
        await new Promise<void>((resolve) =>
          globalThis.setTimeout(resolve, PIPELINE_AGENT_PROJECTION_POLL_INTERVAL_MS),
        );
      }

      input.onEvent({
        type: "error",
        code: "AGENT_RUN_PROJECTION_TIMEOUT",
        message: "The run completed, but its pipeline-agent result was not persisted in time.",
      });
    },
  };
};

export type PipelineAgentSessionsClient = ReturnType<typeof createPipelineAgentSessionsClient>;

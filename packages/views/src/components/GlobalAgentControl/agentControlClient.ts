import { Result } from "neverthrow";
import { z } from "zod/v4";
import {
  AgentActionSchema,
  AgentApprovalSchema,
  AgentChangeSetSchema,
  AgentContextEnvelopeSchema,
  AgentControlCapabilitiesSchema,
  AgentRunSchema,
  AgentThreadSchema,
  PipelineAgentMessageKindSchema,
  PipelineAgentMessageRoleSchema,
  type AgentContextEnvelope,
} from "@repo/schemas";
import { consumeAgentRunEventStream } from "../../lib/agentRunEventsClient";
import { subscribeAgentActivity } from "../AgentActivity/agentActivityStore";
import type { PlatformCapabilities } from "../../platform";

const AgentThreadMessageClientSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  role: PipelineAgentMessageRoleSchema,
  kind: PipelineAgentMessageKindSchema,
  content: z.string(),
  context: AgentContextEnvelopeSchema.nullable().default(null),
  runId: z.string().min(1).nullable().default(null),
  createdAt: z.iso.datetime(),
});

const AgentRunStartResponseSchema = z.object({ runId: z.string().min(1) });
const AgentApprovalResponseSchema = z.object({
  approval: AgentApprovalSchema,
  resumedRunId: z.string().min(1).nullable(),
  resumeError: z.string().min(1).nullable(),
});
const VersionConflictSchema = z.object({
  type: z.literal("version_conflict"),
  actualVersion: z.number().int().positive().nullable(),
});
const InvalidStateSchema = z.object({
  type: z.literal("invalid_state"),
  status: z.string().min(1),
});
const ChangeSetNotFoundSchema = z.object({ type: z.literal("change_set_not_found") });
const HistoryDivergedSchema = z.object({ type: z.literal("history_diverged") });
const AppliedChangeSetSchema = z.object({
  type: z.literal("applied"),
  changeSet: AgentChangeSetSchema,
  previousVersion: z.number().int().positive(),
  newVersion: z.number().int().positive(),
});
const ChangeSetOperationSchema = z.discriminatedUnion("type", [
  AppliedChangeSetSchema,
  VersionConflictSchema,
  InvalidStateSchema,
  ChangeSetNotFoundSchema,
  HistoryDivergedSchema,
]);

const parseJson = Result.fromThrowable(
  (raw: string) => JSON.parse(raw) as unknown,
  () => null,
);

const responseError = async (response: Response): Promise<Error> => {
  const raw = await response.text();
  const parsed = parseJson(raw).unwrapOr(null);
  const message =
    parsed && typeof parsed === "object" && "error" in parsed && typeof parsed.error === "string"
      ? parsed.error
      : raw || `Agent Control request failed with status ${response.status}`;

  return new Error(message);
};

const readJson = async <T>(response: Response, schema: z.ZodType<T>): Promise<T> => {
  const raw = await response.text();
  if (!response.ok) throw await responseError(new Response(raw, { status: response.status }));
  const parsed = parseJson(raw);
  if (parsed.isErr()) throw new Error("Agent Control returned invalid JSON");

  return schema.parse(parsed.value);
};

type AgentControlTransport = Pick<PlatformCapabilities, "apiBaseUrl" | "request">;

export const createAgentControlClient = (platform: AgentControlTransport) => {
  const baseUrl = `${platform.apiBaseUrl}/agent-threads`;
  const requestJson = (url: string, method: string, body?: unknown) =>
    platform.request(url, {
      method,
      ...(body === undefined
        ? {}
        : {
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          }),
    });

  return {
    getCapabilities: async () =>
      readJson(await platform.request(`${baseUrl}/capabilities`), AgentControlCapabilitiesSchema),
    listThreads: async () => readJson(await platform.request(baseUrl), z.array(AgentThreadSchema)),
    createThread: async (context: AgentContextEnvelope, title?: string) =>
      readJson(
        await requestJson(baseUrl, "POST", { context, ...(title ? { title } : {}) }),
        AgentThreadSchema,
      ),
    updateThreadContext: async (threadId: string, context: AgentContextEnvelope) =>
      readJson(
        await requestJson(`${baseUrl}/${encodeURIComponent(threadId)}`, "PATCH", { context }),
        AgentThreadSchema,
      ),
    listMessages: async (threadId: string) =>
      readJson(
        await platform.request(`${baseUrl}/${encodeURIComponent(threadId)}/messages`),
        z.array(AgentThreadMessageClientSchema),
      ),
    startRun: async (
      threadId: string,
      input: {
        message: string;
        context: AgentContextEnvelope;
        runtimeId?: string;
        model?: string;
        reasoningEffort?: string;
        speed?: string;
        firstOutputTimeoutSeconds?: number;
      },
    ) =>
      readJson(
        await requestJson(`${baseUrl}/${encodeURIComponent(threadId)}/runs`, "POST", input),
        AgentRunStartResponseSchema,
      ),
    getLatestRun: async (threadId: string) => {
      const response = await platform.request(
        `${baseUrl}/${encodeURIComponent(threadId)}/runs/latest`,
      );
      if (response.status === 404) return null;

      return readJson(response, AgentRunSchema);
    },
    cancelRun: async (runId: string) =>
      readJson(
        await requestJson(
          `${platform.apiBaseUrl}/agent-runs/${encodeURIComponent(runId)}/cancel`,
          "POST",
        ),
        AgentRunSchema,
      ),
    listChangeSets: async (threadId: string) =>
      readJson(
        await platform.request(`${baseUrl}/${encodeURIComponent(threadId)}/change-sets`),
        z.array(AgentChangeSetSchema),
      ),
    listActions: async (threadId: string) =>
      readJson(
        await platform.request(`${baseUrl}/${encodeURIComponent(threadId)}/actions`),
        z.array(AgentActionSchema),
      ),
    listApprovals: async (threadId: string) =>
      readJson(
        await platform.request(`${baseUrl}/${encodeURIComponent(threadId)}/approvals`),
        z.array(AgentApprovalSchema),
      ),
    approve: async (threadId: string, approvalId: string) =>
      readJson(
        await requestJson(
          `${baseUrl}/${encodeURIComponent(threadId)}/approvals/${encodeURIComponent(approvalId)}/approve`,
          "POST",
        ),
        AgentApprovalResponseSchema,
      ),
    rejectApproval: async (threadId: string, approvalId: string) =>
      readJson(
        await requestJson(
          `${baseUrl}/${encodeURIComponent(threadId)}/approvals/${encodeURIComponent(approvalId)}/reject`,
          "POST",
        ),
        AgentApprovalSchema,
      ),
    applyChangeSet: async (threadId: string, changeSetId: string, expectedVersion: number) =>
      readJson(
        await requestJson(
          `${baseUrl}/${encodeURIComponent(threadId)}/change-sets/${encodeURIComponent(changeSetId)}/apply`,
          "POST",
          { expectedVersion },
        ),
        ChangeSetOperationSchema,
      ),
    rejectChangeSet: async (threadId: string, changeSetId: string) =>
      readJson(
        await requestJson(
          `${baseUrl}/${encodeURIComponent(threadId)}/change-sets/${encodeURIComponent(changeSetId)}/reject`,
          "POST",
        ),
        AgentChangeSetSchema,
      ),
    revertChangeSet: async (threadId: string, changeSetId: string, expectedVersion: number) =>
      readJson(
        await requestJson(
          `${baseUrl}/${encodeURIComponent(threadId)}/change-sets/${encodeURIComponent(changeSetId)}/revert`,
          "POST",
          { expectedVersion },
        ),
        ChangeSetOperationSchema,
      ),
    redoChangeSet: async (threadId: string, changeSetId: string, expectedVersion: number) =>
      readJson(
        await requestJson(
          `${baseUrl}/${encodeURIComponent(threadId)}/change-sets/${encodeURIComponent(changeSetId)}/redo`,
          "POST",
          { expectedVersion },
        ),
        ChangeSetOperationSchema,
      ),
    consumeEvents: (
      runId: string,
      input: Omit<Parameters<typeof consumeAgentRunEventStream>[1], "runId">,
    ) => consumeAgentRunEventStream(platform, { ...input, runId }),
    subscribeActivity: (runId: string, listener: Parameters<typeof subscribeAgentActivity>[2]) =>
      subscribeAgentActivity(runId, platform, listener),
  };
};

export type AgentControlClient = ReturnType<typeof createAgentControlClient>;
export type AgentThreadMessageClient = z.infer<typeof AgentThreadMessageClientSchema>;
export type ChangeSetOperation = z.infer<typeof ChangeSetOperationSchema>;

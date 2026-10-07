import {
  applyAgentRunActivityPatch,
  reduceAgentRunActivity,
  reduceAgentRunActivityEvents,
} from "@repo/agent-activity";

import { createAgentRunEventsDao, createAgentRunsDao } from "@repo/models";
import {
  AgentRunActivityMetricsSchema,
  AgentRunActivitySnapshotSchema,
  TERMINAL_AGENT_RUN_STATUSES,
  type AgentRunEvent,
  type AgentRunEventEnvelope,
  type AgentRunUsage,
} from "@repo/schemas";

import { sanitizeAgentRunEvent } from "../sanitizeAgentRunData/sanitizeAgentRunData.helper";
import type {
  AgentRunPatch,
  ActivityMetricsDelta,
  AgentRunsServiceBindings,
} from "../../contracts";

import { bytesOfJson } from "../bytesOfJson";
import { mergeActivityMetrics } from "../mergeActivityMetrics";
import { commitAgentRunEventBeforeBroadcast } from "../commitAgentRunEventBeforeBroadcast";

export const createPersistEventHelper =
  (
    serviceBindings: Pick<AgentRunsServiceBindings, "serializeRunPersistence" | "db" | "broadcast">,
  ) =>
  async (
    runId: string,
    event: AgentRunEvent,
    runPatch: AgentRunPatch = {},
    activityMetricsDelta: ActivityMetricsDelta = {},
  ): Promise<AgentRunEventEnvelope> => {
    const sanitized = sanitizeAgentRunEvent(event);

    return (0, serviceBindings.serializeRunPersistence)(runId, async () =>
      commitAgentRunEventBeforeBroadcast(
        () =>
          serviceBindings.db.transaction(async (transaction) => {
            const transactionRunsDao = createAgentRunsDao(transaction);
            const transactionEventsDao = createAgentRunEventsDao(transaction);
            const current = await transactionRunsDao.findById(runId);
            if (!current) throw new Error(`Agent run not found: ${runId}`);
            if (TERMINAL_AGENT_RUN_STATUSES.has(current.status) && sanitized.type !== "terminal") {
              throw new Error(`Agent run ${runId} has an immutable terminal state`);
            }
            const terminalTransition =
              sanitized.type === "terminal"
                ? await transactionRunsDao.transition(runId, ["queued", "running", "cancelling"], {
                    ...runPatch,
                    status: sanitized.status,
                    executorId: null,
                    heartbeatAt: null,
                    leaseExpiresAt: null,
                  })
                : null;
            if (sanitized.type === "terminal" && !terminalTransition) {
              const existing = await transactionEventsDao.findTerminalByRunId(runId);
              if (!existing) throw new Error(`Agent run ${runId} has an immutable terminal state`);

              return {
                runId,
                sequence: existing.sequence,
                createdAt: existing.createdAt.toISOString(),
                event: existing.event,
              } satisfies AgentRunEventEnvelope;
            }
            const transitioned =
              terminalTransition ??
              (Object.keys(runPatch).length > 0
                ? await transactionRunsDao.transition(
                    runId,
                    ["queued", "running", "cancelling"],
                    runPatch,
                  )
                : null) ??
              current;

            const created = await transactionEventsDao.create({ runId, event: sanitized });
            const envelope = {
              runId,
              sequence: created.sequence,
              createdAt: created.createdAt.toISOString(),
              event: created.event,
            } satisfies AgentRunEventEnvelope;
            const priorSnapshot = transitioned.activitySnapshot
              ? AgentRunActivitySnapshotSchema.safeParse(transitioned.activitySnapshot)
              : null;
            const snapshotBeforeEvent = priorSnapshot?.success
              ? priorSnapshot.data
              : reduceAgentRunActivityEvents(
                  runId,
                  transitioned.runtime,
                  (await transactionEventsDao.findManyByRunIdAfter(runId, 0, 100_000)).map(
                    (entry) => ({
                      runId,
                      sequence: entry.sequence,
                      createdAt: entry.createdAt.toISOString(),
                      event: entry.event,
                    }),
                  ),
                  "queued",
                );
            const reducedSnapshot = reduceAgentRunActivity(snapshotBeforeEvent, envelope).snapshot;
            const snapshot = applyAgentRunActivityPatch(reducedSnapshot, {
              ...(sanitized.type === "terminal"
                ? {
                    status: sanitized.status,
                    terminalMessage: sanitized.resultText ?? null,
                    terminalAt: envelope.createdAt,
                  }
                : {}),
              ...(runPatch.status ? { status: runPatch.status } : {}),
              ...(runPatch.usage !== undefined
                ? { usage: (runPatch.usage ?? null) as AgentRunUsage | null }
                : {}),
              ...(runPatch.errorCode !== undefined
                ? { errorCode: runPatch.errorCode ?? null }
                : {}),
              ...(runPatch.resultText !== undefined
                ? { terminalMessage: runPatch.resultText ?? null }
                : {}),
              ...(runPatch.finishedAt !== undefined
                ? { terminalAt: runPatch.finishedAt?.toISOString() ?? null }
                : {}),
            });
            const existingMetrics = transitioned.activityMetrics
              ? AgentRunActivityMetricsSchema.safeParse(transitioned.activityMetrics)
              : null;
            const metrics = mergeActivityMetrics(
              existingMetrics?.success ? existingMetrics.data : null,
              {
                eventCount: 1,
                bytes: bytesOfJson(sanitized),
                ...activityMetricsDelta,
              },
            );
            await transactionRunsDao.update(runId, {
              ...(sanitized.type === "terminal" ? { terminalEventSequence: created.sequence } : {}),
              activitySnapshot: snapshot,
              activityMetrics: metrics,
            });

            return envelope;
          }),
        serviceBindings.broadcast,
      ),
    );
  };

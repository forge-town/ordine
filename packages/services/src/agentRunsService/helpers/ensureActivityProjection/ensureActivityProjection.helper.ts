import { applyAgentRunActivityPatch, reduceAgentRunActivityEvents } from "@repo/agent-activity";

import type { AgentRunRecord } from "@repo/db-schema";

import {
  AgentRunActivityMetricsSchema,
  AgentRunActivitySnapshotSchema,
  RuntimeCapabilitiesSchema,
  type AgentRunEventEnvelope,
} from "@repo/schemas";

import { bytesOfJson } from "../bytesOfJson";
import { capabilitySnapshotForRuntime } from "../capabilitySnapshotForRuntime";

import type { AgentRunsServiceBindings } from "../../contracts";
export const createEnsureActivityProjectionHelper =
  (serviceBindings: Pick<AgentRunsServiceBindings, "eventsDao">) =>
  async (record: AgentRunRecord): Promise<AgentRunRecord> => {
    // Legacy runs are projected from their canonical events without mutating
    // the record during a read. New writes backfill the durable snapshot in
    // the same event transaction, so this path remains a strictly read-only
    // compatibility fallback.
    const parsedSnapshot = record.activitySnapshot
      ? AgentRunActivitySnapshotSchema.safeParse(record.activitySnapshot)
      : null;
    const parsedMetrics = record.activityMetrics
      ? AgentRunActivityMetricsSchema.safeParse(record.activityMetrics)
      : null;
    const parsedCapabilities = record.runtimeCapabilities
      ? RuntimeCapabilitiesSchema.safeParse(record.runtimeCapabilities)
      : null;
    if (parsedSnapshot?.success && parsedMetrics?.success && parsedCapabilities?.success) {
      return record;
    }

    const events = await serviceBindings.eventsDao.findManyByRunIdAfter(record.id, 0, 100_000);
    const envelopes = events.map((event) => ({
      runId: record.id,
      sequence: event.sequence,
      createdAt: event.createdAt.toISOString(),
      event: event.event,
    })) satisfies AgentRunEventEnvelope[];
    const rebuiltSnapshot = parsedSnapshot?.success
      ? applyAgentRunActivityPatch(parsedSnapshot.data, {
          status: record.status,
          usage: record.usage,
          errorCode: record.errorCode,
          terminalMessage: record.resultText,
          terminalAt: record.finishedAt?.toISOString() ?? null,
        })
      : reduceAgentRunActivityEvents(record.id, record.runtime, envelopes, "queued");
    const snapshot = AgentRunActivitySnapshotSchema.parse(rebuiltSnapshot);
    const metrics = parsedMetrics?.success
      ? parsedMetrics.data
      : AgentRunActivityMetricsSchema.parse({
          eventCount: events.length,
          bytes: events.reduce((total, event) => total + bytesOfJson(event.event), 0),
        });
    const runtimeCapabilities = parsedCapabilities?.success
      ? parsedCapabilities.data
      : capabilitySnapshotForRuntime(record.runtime);

    return {
      ...record,
      runtimeCapabilities,
      activitySnapshot: snapshot,
      activityMetrics: metrics,
    };
  };

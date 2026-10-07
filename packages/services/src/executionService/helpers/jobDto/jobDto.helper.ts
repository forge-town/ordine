import type { ExecutionJobRecord } from "@repo/db-schema";
import { ExecutionJobSchema } from "@repo/schemas";

export const jobDto = (row: ExecutionJobRecord) =>
  ExecutionJobSchema.parse({
    apiVersion: 2,
    id: row.id,
    preparedRunId: row.preparedRunId,
    revision: row.revision,
    state: row.state,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
    deadlineAt: row.deadlineAt?.toISOString() ?? null,
    waitingDeadlineAt: row.waitingDeadlineAt?.toISOString() ?? null,
    stopReason: row.stopReason,
    error: row.error,
    warnings: row.warnings,
  });

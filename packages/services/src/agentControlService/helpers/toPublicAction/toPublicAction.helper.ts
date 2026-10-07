import { AgentActionSchema } from "@repo/schemas";

import type { PersistedAction } from "../../contracts";

export const toPublicAction = (row: PersistedAction) =>
  AgentActionSchema.parse({
    id: row.id,
    threadId: row.threadId,
    runId: row.runId,
    changeSetId: row.changeSetId,
    sequence: row.sequence,
    toolName: row.toolName,
    risk: row.risk,
    status: row.status,
    target: row.targetType && row.targetId ? { type: row.targetType, id: row.targetId } : null,
    redactedInput: row.redactedInput,
    result: row.result,
    forwardAction: row.forwardAction,
    inverseActions: row.inverseActions,
    idempotencyKey: row.idempotencyKey,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  });

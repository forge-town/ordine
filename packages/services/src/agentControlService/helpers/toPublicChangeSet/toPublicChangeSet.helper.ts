import type { createAgentChangeSetsDao } from "@repo/models";
import { AgentChangeSetSchema } from "@repo/schemas";

export const toPublicChangeSet = (
  row: NonNullable<Awaited<ReturnType<ReturnType<typeof createAgentChangeSetsDao>["findById"]>>>,
) =>
  AgentChangeSetSchema.parse({
    id: row.id,
    threadId: row.threadId,
    runId: row.runId,
    actor: row.actor,
    kind: row.kind,
    originChangeSetId: row.originChangeSetId,
    target: { type: row.targetType, id: row.targetId },
    baseVersion: row.baseVersion,
    revision: row.revision,
    appliedVersion: row.appliedVersion,
    status: row.status,
    baseSnapshot: row.baseSnapshot,
    draftSnapshot: row.draftSnapshot,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    committedAt: row.committedAt?.toISOString() ?? null,
  });

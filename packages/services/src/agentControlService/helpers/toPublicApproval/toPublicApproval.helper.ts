import type { createAgentApprovalsDao } from "@repo/models";
import { AgentApprovalSchema } from "@repo/schemas";

export const toPublicApproval = (
  row: NonNullable<Awaited<ReturnType<ReturnType<typeof createAgentApprovalsDao>["findById"]>>>,
) =>
  AgentApprovalSchema.parse({
    id: row.id,
    threadId: row.threadId,
    runId: row.runId,
    actionId: row.actionId,
    toolName: row.toolName,
    callId: row.callId,
    argumentDigest: row.argumentDigest,
    target: row.targetType && row.targetId ? { type: row.targetType, id: row.targetId } : null,
    resourceVersion: row.resourceVersion,
    status: row.status,
    expiresAt: row.expiresAt.toISOString(),
    approvedAt: row.approvedAt?.toISOString() ?? null,
    consumedAt: row.consumedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  });

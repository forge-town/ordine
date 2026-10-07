import type { createAgentThreadsDao } from "@repo/models";
import { AgentThreadSchema, type AgentThread } from "@repo/schemas";

export const toThread = (
  row: NonNullable<Awaited<ReturnType<ReturnType<typeof createAgentThreadsDao>["findById"]>>>,
): AgentThread =>
  AgentThreadSchema.parse({
    id: row.id,
    title: row.title,
    actor: row.actor,
    status: row.threadStatus,
    activeContext: row.activeContext ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });

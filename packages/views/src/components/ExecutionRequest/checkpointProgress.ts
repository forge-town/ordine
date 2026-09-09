import type { ExecutionEvent } from "@repo/schemas";

export type CheckpointProgress = Record<string, { state: string; acknowledged: boolean }>;
export const advanceCheckpointProgress = (
  previous: CheckpointProgress,
  events: ExecutionEvent[],
): CheckpointProgress => {
  const next = { ...previous };
  for (const event of [...events].sort((left, right) => left.sequence - right.sequence)) {
    if (!event.nodeId) continue;
    const existing = next[event.nodeId] ?? { state: "queued", acknowledged: false };
    if (event.type === "node_state" && typeof event.payload.state === "string")
      next[event.nodeId] = { ...existing, state: event.payload.state };
    if (event.type === "checkpoint_acknowledged")
      next[event.nodeId] = { ...existing, acknowledged: true };
  }

  return next;
};

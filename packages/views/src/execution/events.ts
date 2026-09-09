import type { ExecutionEvent } from "@repo/schemas";

export const mergeExecutionEvents = (
  jobId: string | null,
  previous: ExecutionEvent[],
  current: ExecutionEvent[],
): ExecutionEvent[] =>
  [
    ...new Map(
      [...previous, ...current]
        .filter((event) => event.jobId === jobId)
        .map((event) => [event.sequence, event]),
    ).values(),
  ].sort((left, right) => left.sequence - right.sequence);

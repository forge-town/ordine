import { describe, expect, it } from "vitest";
import type { ExecutionEvent } from "@repo/schemas";
import { advanceCheckpointProgress } from "./checkpointProgress";

const event = (sequence: number, type: string, state?: string): ExecutionEvent => ({
  sequence,
  type,
  jobId: "job",
  nodeId: "node",
  attemptId: null,
  payload: state ? { state } : {},
  createdAt: "2026-09-08T00:00:00Z",
});
describe("execution checkpoint projection", () => {
  it("uses persisted node_state and acknowledgement events across pages", () => {
    const waiting = advanceCheckpointProgress({}, [event(1, "node_state", "waiting_for_input")]);
    expect(waiting.node).toEqual({ state: "waiting_for_input", acknowledged: false });
    expect(advanceCheckpointProgress(waiting, [event(2, "checkpoint_acknowledged")]).node).toEqual({
      state: "waiting_for_input",
      acknowledged: true,
    });
  });
});

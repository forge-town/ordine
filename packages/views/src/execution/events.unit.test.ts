import { expect, it } from "vitest";
import type { ExecutionEvent } from "@repo/schemas";
import { mergeExecutionEvents } from "./events";

const event = (sequence: number, state: string, jobId = "job-a"): ExecutionEvent => ({
  sequence,
  jobId,
  nodeId: "step",
  attemptId: null,
  type: "node_state",
  payload: { state },
  createdAt: "2026-09-08T00:00:00.000Z",
});

it("keeps overlapping pages unique and applies states in sequence order", () => {
  const first = event(1, "running");
  const last = event(3, "succeeded");
  const merged = mergeExecutionEvents("job-a", [first, event(2, "running")], [last, first]);
  expect(merged.map((entry) => entry.sequence)).toEqual([1, 2, 3]);
  expect(merged.at(-1)?.payload.state).toBe("succeeded");
});

it("does not project another selected Job's late events", () => {
  expect(
    mergeExecutionEvents("job-b", [event(1, "failed")], [event(2, "running", "job-b")]),
  ).toEqual([event(2, "running", "job-b")]);
});

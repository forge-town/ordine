import { describe, expect, it, vi } from "vitest";
import { okAsync } from "neverthrow";
import { executeScenario } from "../helpers/makePipelineScenario";
import { makeNode } from "../helpers/makeNode";
import { makeEdge } from "../helpers/makeEdge";
import { makeTestDeps } from "../helpers/makeTestDeps";
import { PipelineCancelledError } from "../../errors";
import type { OperationInfo } from "../../nodes/types";

const makeOperation = (operationId: string, name: string): [string, OperationInfo] => [
  operationId,
  {
    id: operationId,
    name,
    config: {
      executor: {
        type: "agent",
        agentMode: "prompt",
        prompt: `Run ${name}`,
      },
    },
  },
];

/*
Pipeline shape:

  [op-1] --> [op-2]
*/
describe("pipeline scenario: cancellation", () => {
  it("stops before the first node when cancellation is already requested", async () => {
    const deps = makeTestDeps();
    const statusEvents: string[] = [];

    const result = await executeScenario({
      deps,
      runControl: { shouldCancelBeforeNode: () => true },
      nodes: [makeNode("op-1", "operation", { operationId: "op-1" })],
      operations: new Map<string, OperationInfo>([makeOperation("op-1", "First Step")]),
      onNodeStatusChange: ({ nodeId, status }) => {
        statusEvents.push(`${nodeId}:${status}`);
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(PipelineCancelledError);
    }
    expect(deps.runPrompt).not.toHaveBeenCalled();
    expect(statusEvents).toContain("op-1:skipped");
  });

  it("stops at the next node boundary when cancellation is requested mid-run", async () => {
    const cancelState = { requested: false };
    const deps = makeTestDeps({
      runPrompt: vi.fn().mockImplementation(() => {
        // Simulate a cancellation arriving while the first node is executing.
        cancelState.requested = true;

        return okAsync("prompt-output");
      }),
    });
    const statusEvents: string[] = [];

    const result = await executeScenario({
      deps,
      runControl: { shouldCancelBeforeNode: () => cancelState.requested },
      nodes: [
        makeNode("op-1", "operation", { operationId: "op-1" }),
        makeNode("op-2", "operation", { operationId: "op-2" }),
      ],
      edges: [makeEdge("op-1", "op-2")],
      operations: new Map<string, OperationInfo>([
        makeOperation("op-1", "First Step"),
        makeOperation("op-2", "Second Step"),
      ]),
      onNodeStatusChange: ({ nodeId, status }) => {
        statusEvents.push(`${nodeId}:${status}`);
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(PipelineCancelledError);
    }
    // The executing node finishes (soft cancel), the next node never starts.
    expect(deps.runPrompt).toHaveBeenCalledOnce();
    expect(statusEvents).toContain("op-1:done");
    expect(statusEvents).toContain("op-2:skipped");
    expect(statusEvents).not.toContain("op-2:running");
  });

  it("does not run the node when a pause wake-up was triggered by cancellation", async () => {
    const controlState = { pauseRequested: true, cancelRequested: false };
    const deps = makeTestDeps();
    const statusEvents: string[] = [];

    const result = await executeScenario({
      deps,
      runControl: {
        shouldPauseBeforeNode: () => controlState.pauseRequested,
        shouldCancelBeforeNode: () => controlState.cancelRequested,
        waitForResume: async () => {
          // Simulate cancelRun: set the cancel flag, then release the waiter.
          controlState.cancelRequested = true;
        },
      },
      nodes: [makeNode("op-1", "operation", { operationId: "op-1" })],
      operations: new Map<string, OperationInfo>([makeOperation("op-1", "First Step")]),
      onNodeStatusChange: ({ nodeId, status }) => {
        statusEvents.push(`${nodeId}:${status}`);
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(PipelineCancelledError);
    }
    expect(deps.runPrompt).not.toHaveBeenCalled();
    expect(statusEvents).toContain("op-1:waitingForUser");
    expect(statusEvents).toContain("op-1:skipped");
  });

  it("does not execute a checkpoint node when its wake-up was triggered by cancellation", async () => {
    const controlState = { cancelRequested: false };
    const deps = makeTestDeps();
    const statusEvents: string[] = [];

    const result = await executeScenario({
      deps,
      runControl: {
        shouldCancelBeforeNode: () => controlState.cancelRequested,
        waitForResume: async () => {
          controlState.cancelRequested = true;
        },
      },
      nodes: [makeNode("op-1", "operation", { operationId: "op-1", checkpoint: true })],
      operations: new Map<string, OperationInfo>([makeOperation("op-1", "Review Step")]),
      onNodeStatusChange: ({ nodeId, status }) => {
        statusEvents.push(`${nodeId}:${status}`);
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(PipelineCancelledError);
    }
    expect(deps.runPrompt).not.toHaveBeenCalled();
    expect(statusEvents).toContain("op-1:waitingForUser");
    expect(statusEvents).toContain("op-1:skipped");
  });
});

import { errAsync, okAsync } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import { executeScenario } from "../helpers/makePipelineScenario";
import { makeNode } from "../helpers/makeNode";
import type { OperationInfo } from "../../nodes/types";
import { makeEdge } from "../helpers/makeEdge";
import { makePromptFailureDeps, makeTestDeps } from "../helpers/makeTestDeps";

/*
Pipeline shape:

  [start] --> [failing-op] --> [downstream-op]

Expected runtime behavior:
  - failing-op returns an error
  - downstream-op never runs
*/
describe("pipeline scenario: failure flow", () => {
  it("stops executing downstream levels after an operation failure", async () => {
    const deps = makePromptFailureDeps();
    const operations = new Map<string, OperationInfo>([
      [
        "fail-op",
        {
          id: "fail-op",
          name: "Fail Operation",
          config: {
            executor: { type: "agent", agentMode: "prompt", prompt: "This will fail" },
          },
        },
      ],
      [
        "downstream-op",
        {
          id: "downstream-op",
          name: "Downstream Operation",
          config: {
            executor: { type: "agent", agentMode: "prompt", prompt: "This should never run" },
          },
        },
      ],
    ]);
    const statusEvents: string[] = [];

    const result = await executeScenario({
      deps,
      operations,
      nodes: [
        makeNode("start", "folder", { folderPath: "/virtual/project" }),
        makeNode("failing-op", "operation", { operationId: "fail-op" }),
        makeNode("downstream-op", "operation", { operationId: "downstream-op" }),
      ],
      edges: [makeEdge("start", "failing-op"), makeEdge("failing-op", "downstream-op")],
      onNodeStatusChange: ({ nodeId, status }) => {
        statusEvents.push(`${nodeId}:${status}`);
      },
    });

    expect(result.ok).toBe(false);
    expect(deps.runPrompt).toHaveBeenCalledTimes(2);
    expect(statusEvents).toEqual([
      "start:queued",
      "failing-op:queued",
      "downstream-op:queued",
      "start:running",
      "start:done",
      "failing-op:running",
      "failing-op:failed",
      "failing-op:retrying",
      "failing-op:running",
      "failing-op:failed",
      "downstream-op:skipped",
    ]);
  });

  it("retries a failed operation once before failing the pipeline", async () => {
    const deps = makeTestDeps({
      runPrompt: vi
        .fn()
        .mockReturnValueOnce(errAsync(new Error("temporary prompt failure")))
        .mockReturnValueOnce(okAsync("recovered output")),
    });
    const operations = new Map<string, OperationInfo>([
      [
        "flaky-op",
        {
          id: "flaky-op",
          name: "Flaky Operation",
          config: {
            executor: { type: "agent", agentMode: "prompt", prompt: "Recover" },
          },
        },
      ],
    ]);
    const statusEvents: string[] = [];

    const result = await executeScenario({
      deps,
      operations,
      nodes: [makeNode("flaky-op", "operation", { operationId: "flaky-op" })],
      onNodeStatusChange: ({ nodeId, status }) => {
        statusEvents.push(`${nodeId}:${status}`);
      },
    });

    expect(result.ok).toBe(true);
    expect(deps.runPrompt).toHaveBeenCalledTimes(2);
    expect(statusEvents).toEqual([
      "flaky-op:queued",
      "flaky-op:running",
      "flaky-op:failed",
      "flaky-op:retrying",
      "flaky-op:running",
      "flaky-op:done",
    ]);
  });
});

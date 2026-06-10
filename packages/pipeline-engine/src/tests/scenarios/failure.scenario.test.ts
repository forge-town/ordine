import { describe, expect, it } from "vitest";
import { executeScenario } from "../helpers/makePipelineScenario";
import { makeNode } from "../helpers/makeNode";
import type { OperationInfo } from "../../nodes/types";
import { makeEdge } from "../helpers/makeEdge";
import { makePromptFailureDeps } from "../helpers/makeTestDeps";

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
    expect(deps.runPrompt).toHaveBeenCalledTimes(1);
    expect(statusEvents).toEqual([
      "start:queued",
      "failing-op:queued",
      "downstream-op:queued",
      "start:running",
      "start:done",
      "failing-op:running",
      "failing-op:failed",
      "downstream-op:skipped",
    ]);
  });
});

import { describe, expect, it } from "vitest";
import { executeScenario } from "../helpers/makePipelineScenario";
import { makeNode } from "../helpers/makeNode";
import { makeEdge } from "../helpers/makeEdge";
import { makeTestDeps } from "../helpers/makeTestDeps";

/*
Pipeline shapes:

Cycle case:
  [a] --> [b]
   ^       |
   |       v
   +-------+

Disconnected sources case:
  [op-a-node]

  [op-b-node]
*/
describe("pipeline scenario: invalid graph", () => {
  it("returns an error when the graph contains a cycle", async () => {
    const deps = makeTestDeps();

    const result = await executeScenario({
      deps,
      nodes: [makeNode("a", "operation"), makeNode("b", "operation")],
      edges: [makeEdge("a", "b"), makeEdge("b", "a")],
    });

    expect(result.ok).toBe(false);
  });

  it("still executes disconnected source nodes as independent branches", async () => {
    const deps = makeTestDeps();
    const operations = new Map([
      [
        "op-a",
        {
          id: "op-a",
          name: "Operation A",
          config: JSON.stringify({
            executor: { type: "agent", agentMode: "prompt", prompt: "Run A" },
          }),
        },
      ],
      [
        "op-b",
        {
          id: "op-b",
          name: "Operation B",
          config: JSON.stringify({
            executor: { type: "agent", agentMode: "prompt", prompt: "Run B" },
          }),
        },
      ],
    ]);

    const result = await executeScenario({
      deps,
      operations,
      nodes: [
        makeNode("op-a-node", "operation", { operationId: "op-a" }),
        makeNode("op-b-node", "operation", { operationId: "op-b" }),
      ],
    });

    expect(result.ok).toBe(true);
    expect(deps.runPrompt).toHaveBeenCalledTimes(2);
  });
});

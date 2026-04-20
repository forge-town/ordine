import { describe, expect, it } from "vitest";
import { executeScenario } from "../helpers/makePipelineScenario";
import { makeNode } from "../helpers/makeNode";
import { makeEdge } from "../helpers/makeEdge";
import { makeTestDeps } from "../helpers/makeTestDeps";

/*
Pipeline shape:

  [folder]
     | \
     |  \
     v   v
  [lint-op]   [summary-op]
*/
describe("pipeline scenario: branching flow", () => {
  it("runs sibling operation nodes from the same parent", async () => {
    const deps = makeTestDeps();
    const operations = new Map([
      [
        "lint",
        {
          id: "lint",
          name: "Lint",
          config: JSON.stringify({
            executor: { type: "agent", agentMode: "prompt", prompt: "Lint the input" },
          }),
        },
      ],
      [
        "summarize",
        {
          id: "summarize",
          name: "Summarize",
          config: JSON.stringify({
            executor: { type: "agent", agentMode: "prompt", prompt: "Summarize the input" },
          }),
        },
      ],
    ]);

    const result = await executeScenario({
      deps,
      operations,
      nodes: [
        makeNode("folder", "folder", { folderPath: "/virtual/project" }),
        makeNode("lint-op", "operation", { operationId: "lint" }),
        makeNode("summary-op", "operation", { operationId: "summarize" }),
      ],
      edges: [makeEdge("folder", "lint-op"), makeEdge("folder", "summary-op")],
    });

    expect(result.ok).toBe(true);
    expect(deps.runPrompt).toHaveBeenCalledTimes(2);
  });
});

import { describe, expect, it } from "vitest";
import { executeScenario } from "../helpers/makePipelineScenario";
import { makeNode } from "../helpers/makeNode";
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
    const operations = new Map([
      [
        "fail-op",
        {
          id: "fail-op",
          name: "Fail Operation",
          config: JSON.stringify({
            executor: { type: "prompt", prompt: "This will fail" },
          }),
        },
      ],
      [
        "downstream-op",
        {
          id: "downstream-op",
          name: "Downstream Operation",
          config: JSON.stringify({
            executor: { type: "prompt", prompt: "This should never run" },
          }),
        },
      ],
    ]);

    const result = await executeScenario({
      deps,
      operations,
      nodes: [
        makeNode("start", "folder", { folderPath: "/virtual/project" }),
        makeNode("failing-op", "operation", { operationId: "fail-op" }),
        makeNode("downstream-op", "operation", { operationId: "downstream-op" }),
      ],
      edges: [makeEdge("start", "failing-op"), makeEdge("failing-op", "downstream-op")],
    });

    expect(result.ok).toBe(false);
    expect(deps.runPrompt).toHaveBeenCalledTimes(1);
  });
});

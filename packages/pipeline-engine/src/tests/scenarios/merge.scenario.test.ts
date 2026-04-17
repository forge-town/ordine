import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { executeScenario } from "../helpers/makePipelineScenario";
import { makeNode } from "../helpers/makeNode";
import { makeEdge } from "../helpers/makeEdge";
import { makeTestDeps } from "../helpers/makeTestDeps";

/*
Pipeline shape:

  [file-a] \
            \
             --> [merge-op]
            /
  [file-b] /
*/
describe("pipeline scenario: merge flow", () => {
  it("merges parent outputs before passing them into a downstream operation", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pipeline-merge-"));
    const firstFile = join(dir, "first.ts");
    const secondFile = join(dir, "second.ts");

    await writeFile(firstFile, "const first = 1;", "utf8");
    await writeFile(secondFile, "const second = 2;", "utf8");

    const deps = makeTestDeps();
    const operationId = "merge-review";

    const result = await executeScenario({
      deps,
      operations: new Map([
        [
          operationId,
          {
            id: operationId,
            name: "Merge Review",
            config: JSON.stringify({
              executor: { type: "prompt", prompt: "Review the merged content" },
            }),
          },
        ],
      ]),
      nodes: [
        makeNode("file-a", "code-file", { filePath: firstFile }),
        makeNode("file-b", "code-file", { filePath: secondFile }),
        makeNode("merge-op", "operation", { operationId }),
      ],
      edges: [makeEdge("file-a", "merge-op"), makeEdge("file-b", "merge-op")],
    });

    expect(result.ok).toBe(true);
    expect(deps.runPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        inputContent: expect.stringContaining("const first = 1;\n\n---\n\nconst second = 2;"),
      }),
    );

    await rm(dir, { recursive: true, force: true });
  });
});

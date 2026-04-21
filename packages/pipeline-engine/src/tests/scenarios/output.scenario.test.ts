import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { okAsync } from "neverthrow";
import { describe, expect, it } from "vitest";
import { executeScenario } from "../helpers/makePipelineScenario";
import { makeNode } from "../helpers/makeNode";
import { makeEdge } from "../helpers/makeEdge";
import { makeTestDeps } from "../helpers/makeTestDeps";

/*
Pipeline shape:

  [folder] --> [operation] --> [output]
*/
describe("pipeline scenario: output flow", () => {
  it("writes pipeline output through output-local-path nodes", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pipeline-output-"));
    const deps = makeTestDeps({
      runPrompt: () => okAsync('{"result":"ok"}'),
    });
    const operationId = "serialize";

    const result = await executeScenario({
      deps,
      operations: new Map([
        [
          operationId,
          {
            id: operationId,
            name: "Serialize",
            config: JSON.stringify({
              executor: { type: "agent", agentMode: "prompt", prompt: "Serialize the input" },
            }),
          },
        ],
      ]),
      nodes: [
        makeNode("folder", "folder", { folderPath: "/virtual/project" }),
        makeNode("operation", "operation", { operationId }),
        makeNode("output", "output-local-path", {
          localPath: dir,
          outputFileName: "report.md",
        }),
      ],
      edges: [makeEdge("folder", "operation"), makeEdge("operation", "output")],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.summary).toContain(dir);
    }

    const resultFiles = await readdir(join(dir, "results"));
    expect(resultFiles.length).toBe(1);

    const written = await readFile(join(dir, "results", resultFiles[0]!), "utf8");
    expect(written).toContain("# Markdown");

    await rm(dir, { recursive: true, force: true });
  });
});

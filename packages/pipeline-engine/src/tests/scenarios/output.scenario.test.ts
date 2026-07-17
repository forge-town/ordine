import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { okAsync } from "neverthrow";
import { describe, expect, it } from "vitest";
import { executeScenario } from "../helpers/makePipelineScenario";
import { makeNode } from "../helpers/makeNode";
import { makeEdge } from "../helpers/makeEdge";
import { makeTestDeps } from "../helpers/makeTestDeps";
import type { OperationInfo } from "../../nodes/types";

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
      operations: new Map<string, OperationInfo>([
        [
          operationId,
          {
            id: operationId,
            name: "Serialize",
            config: {
              executor: { type: "agent", agentMode: "prompt", prompt: "Serialize the input" },
            },
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

    const dirEntries = await readdir(dir);
    const resultFiles = dirEntries.filter((f) => f.startsWith("report_"));
    expect(resultFiles.length).toBe(1);

    const written = await readFile(join(dir, resultFiles[0]!), "utf8");
    expect(written).toContain("# Markdown");

    await rm(dir, { recursive: true, force: true });
  });
});

describe("pipeline scenario: output summary honesty", () => {
  it("does not claim outputs for output nodes skipped by an edge condition", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pipeline-output-skipped-"));
    const deps = makeTestDeps({ runPrompt: () => okAsync("no approval here") });
    const gatedEdge = {
      ...makeEdge("op", "out"),
      data: { label: "gated", condition: { expression: 'content.includes("approved")' } },
    };

    const result = await executeScenario({
      deps,
      operations: new Map<string, OperationInfo>([
        [
          "draft-op",
          {
            id: "draft-op",
            name: "Draft Op",
            config: { executor: { type: "agent", agentMode: "prompt", prompt: "Draft" } },
          },
        ],
      ]),
      nodes: [
        makeNode("op", "operation", { operationId: "draft-op" }),
        makeNode("out", "output-local-path", { localPath: join(dir, "report.md") }),
      ],
      edges: [gatedEdge],
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.summary).not.toContain("Output written to");

    await rm(dir, { recursive: true, force: true });
  });
});

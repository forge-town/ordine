import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, vi } from "vitest";
import type { PipelineDecisionEvent } from "../../nodes/DecisionNode";
import { executeScenario } from "../helpers/makePipelineScenario";
import { makeNode } from "../helpers/makeNode";
import { makeEdge } from "../helpers/makeEdge";
import { makeTestDeps } from "../helpers/makeTestDeps";

/*
Pipeline shape:

  [file-a] \
            --> [decision] --> [downstream output]
  [file-b] /
*/
describe("pipeline scenario: human decision flow", () => {
  it("collects per-edge candidates and routes the chosen one downstream", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pipeline-decision-"));
    const fileA = join(dir, "a.ts");
    const fileB = join(dir, "b.ts");
    await writeFile(fileA, "const a = 1;", "utf8");
    await writeFile(fileB, "const b = 2;", "utf8");

    const waitForDecision = vi
      .fn<(event: PipelineDecisionEvent) => Promise<{ selectedCandidateIds: string[] }>>()
      .mockResolvedValue({ selectedCandidateIds: ["file-b-decide"] });

    const result = await executeScenario({
      deps: makeTestDeps(),
      runControl: { waitForDecision },
      nodes: [
        makeNode("file-a", "file", { filePath: fileA }),
        makeNode("file-b", "file", { filePath: fileB }),
        makeNode("decide", "decision", { selectMode: "single" }),
        makeNode("sink", "output-local-path", { localPath: join(dir, "out") }),
      ],
      edges: [
        makeEdge("file-a", "decide"),
        makeEdge("file-b", "decide"),
        makeEdge("decide", "sink"),
      ],
    });

    expect(result.ok).toBe(true);
    expect(waitForDecision).toHaveBeenCalledTimes(1);
    const event = waitForDecision.mock.calls[0]![0];
    expect(event.candidates.map((candidate) => candidate.nodeId).sort()).toEqual([
      "file-a",
      "file-b",
    ]);
    expect(event.candidates.some((candidate) => candidate.content.includes("const b = 2;"))).toBe(
      true,
    );

    await rm(dir, { recursive: true, force: true });
  });

  it("fails the run when no decision handler is wired (no fabricated choice)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pipeline-decision-nohandler-"));
    const fileA = join(dir, "a.ts");
    await writeFile(fileA, "const a = 1;", "utf8");

    const result = await executeScenario({
      deps: makeTestDeps(),
      nodes: [
        makeNode("file-a", "file", { filePath: fileA }),
        makeNode("decide", "decision", { selectMode: "single" }),
      ],
      edges: [makeEdge("file-a", "decide")],
    });

    expect(result.ok).toBe(false);

    await rm(dir, { recursive: true, force: true });
  });
});

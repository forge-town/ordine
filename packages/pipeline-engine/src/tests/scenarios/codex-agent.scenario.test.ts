import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { executeScenario } from "../helpers/makePipelineScenario";
import { makeNode } from "../helpers/makeNode";
import { makeEdge } from "../helpers/makeEdge";
import { makeTestDeps } from "../helpers/makeTestDeps";
import type { OperationInfo } from "../../nodes/types";

describe("pipeline scenario: codex agent", () => {
  it("passes codex agent backend to runPrompt", async () => {
    const folderPath = await mkdtemp(join(tmpdir(), "pipeline-codex-"));
    const deps = makeTestDeps();
    const operationId = "codex-analyze";
    const result = await executeScenario({
      deps,
      nodes: [
        makeNode("folder", "folder", {
          folderPath,
          disclosureMode: "tree",
        }),
        makeNode("operation", "operation", {
          operationId,
        }),
      ],
      edges: [makeEdge("folder", "operation")],
      operations: new Map<string, OperationInfo>([
        [
          operationId,
          {
            id: operationId,
            name: "Codex Analyze",
            config: {
              executor: {
                type: "agent",
                agentMode: "prompt",
                agent: "codex",
                prompt: "Analyze the provided folder using Codex",
              },
            },
          },
        ],
      ]),
    });

    expect(result.ok).toBe(true);
    expect(deps.runPrompt).toHaveBeenCalledOnce();
    expect(deps.runPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: "codex",
      }),
    );

    await rm(folderPath, { recursive: true, force: true });
  });
});

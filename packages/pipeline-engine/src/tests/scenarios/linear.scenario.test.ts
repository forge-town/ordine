import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { executeScenario } from "../helpers/makePipelineScenario";
import { makeNode } from "../helpers/makeNode";
import { makeEdge } from "../helpers/makeEdge";
import { makeTestDeps } from "../helpers/makeTestDeps";
import type { OperationInfo } from "../../nodes/types";

/*
Pipeline shape:

  [folder] --> [operation]
*/
describe("pipeline scenario: linear flow", () => {
  it("runs a simple folder -> operation pipeline", async () => {
    const folderPath = await mkdtemp(join(tmpdir(), "pipeline-linear-"));
    const deps = makeTestDeps();
    const operationId = "analyze-folder";
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
            name: "Analyze Folder",
            config: {
              executor: {
                type: "agent",
                agentMode: "prompt",
                prompt: "Analyze the provided folder",
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
        inputPath: folderPath,
        inputContent: expect.stringContaining("File tree"),
      }),
    );

    await rm(folderPath, { recursive: true, force: true });
  });

  it("emits waitingForUser for checkpoint operation nodes", async () => {
    const deps = makeTestDeps();
    const operationId = "review-step";
    const statusEvents: string[] = [];
    const result = await executeScenario({
      deps,
      nodes: [
        makeNode("operation", "operation", {
          operationId,
          checkpoint: true,
        }),
      ],
      operations: new Map<string, OperationInfo>([
        [
          operationId,
          {
            id: operationId,
            name: "Review Step",
            config: {
              executor: {
                type: "agent",
                agentMode: "prompt",
                prompt: "Review the input",
              },
            },
          },
        ],
      ]),
      onNodeStatusChange: ({ nodeId, status }) => {
        statusEvents.push(`${nodeId}:${status}`);
      },
    });

    expect(result.ok).toBe(true);
    expect(statusEvents).toEqual([
      "operation:queued",
      "operation:running",
      "operation:waitingForUser",
      "operation:done",
    ]);
  });
});

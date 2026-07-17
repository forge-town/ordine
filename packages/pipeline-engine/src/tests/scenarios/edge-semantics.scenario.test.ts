import { okAsync } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import type { PipelineEdge } from "@repo/schemas";
import { executeScenario } from "../helpers/makePipelineScenario";
import { makeEdge } from "../helpers/makeEdge";
import { makeNode } from "../helpers/makeNode";
import { makeTestDeps } from "../helpers/makeTestDeps";
import type { OperationInfo } from "../../nodes/types";

const makePromptOperation = (id: string): OperationInfo => ({
  id,
  name: id,
  config: {
    executor: {
      type: "agent",
      agentMode: "prompt",
      prompt: `Run ${id}`,
    },
  },
});

describe("pipeline scenario: edge semantics", () => {
  it("applies transform steps before passing content to the target node", async () => {
    const runPrompt = vi
      .fn()
      .mockReturnValueOnce(okAsync(" hello "))
      .mockReturnValueOnce(okAsync("done"));
    const deps = makeTestDeps({ runPrompt });
    const edge = {
      ...makeEdge("source", "target"),
      data: {
        label: "candidate",
        transform: {
          steps: [
            { type: "trim", config: {} },
            { type: "uppercase", config: {} },
          ],
        },
      },
    } as PipelineEdge;

    const result = await executeScenario({
      deps,
      operations: new Map([
        ["source-op", makePromptOperation("source-op")],
        ["target-op", makePromptOperation("target-op")],
      ]),
      nodes: [
        makeNode("source", "operation", { operationId: "source-op" }),
        makeNode("target", "operation", { operationId: "target-op" }),
      ],
      edges: [edge],
    });

    expect(result.ok).toBe(true);
    expect(runPrompt).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ inputContent: "HELLO" }),
    );
  });

  it("skips a target node when its only incoming condition is false", async () => {
    const runPrompt = vi.fn().mockReturnValue(okAsync("hello"));
    const deps = makeTestDeps({ runPrompt });
    const edge = {
      ...makeEdge("source", "target"),
      data: { label: "branch", condition: { expression: "false" } },
    } as PipelineEdge;
    const statusEvents: string[] = [];

    const result = await executeScenario({
      deps,
      operations: new Map([
        ["source-op", makePromptOperation("source-op")],
        ["target-op", makePromptOperation("target-op")],
      ]),
      nodes: [
        makeNode("source", "operation", { operationId: "source-op" }),
        makeNode("target", "operation", { operationId: "target-op" }),
      ],
      edges: [edge],
      onNodeStatusChange: ({ nodeId, status }) => {
        statusEvents.push(`${nodeId}:${status}`);
      },
    });

    expect(result.ok).toBe(true);
    expect(runPrompt).toHaveBeenCalledTimes(1);
    expect(statusEvents).toContain("target:skipped");
  });

  it("skips a target node when a quality gate does not pass", async () => {
    const runPrompt = vi.fn().mockReturnValue(okAsync("needs revision"));
    const deps = makeTestDeps({ runPrompt });
    const edge = {
      ...makeEdge("source", "target"),
      data: {
        label: "verified",
        qualityGate: { criteria: "approved", onFail: "skip" },
      },
    } as PipelineEdge;
    const statusEvents: string[] = [];

    const result = await executeScenario({
      deps,
      operations: new Map([
        ["source-op", makePromptOperation("source-op")],
        ["target-op", makePromptOperation("target-op")],
      ]),
      nodes: [
        makeNode("source", "operation", { operationId: "source-op" }),
        makeNode("target", "operation", { operationId: "target-op" }),
      ],
      edges: [edge],
      onNodeStatusChange: ({ nodeId, status }) => {
        statusEvents.push(`${nodeId}:${status}`);
      },
    });

    expect(result.ok).toBe(true);
    expect(runPrompt).toHaveBeenCalledTimes(1);
    expect(statusEvents).toContain("target:skipped");
  });
});

describe("pipeline scenario: quality gate onFail", () => {
  it("aborts the run when a failed gate is configured with onFail 'fail'", async () => {
    const runPrompt = vi.fn().mockReturnValue(okAsync("draft output"));
    const deps = makeTestDeps({ runPrompt });
    const edge = {
      ...makeEdge("source", "target"),
      data: {
        label: "gated",
        qualityGate: { criteria: "approved", onFail: "fail" },
      },
    } as PipelineEdge;

    const result = await executeScenario({
      deps,
      operations: new Map([
        ["source-op", makePromptOperation("source-op")],
        ["target-op", makePromptOperation("target-op")],
      ]),
      nodes: [
        makeNode("source", "operation", { operationId: "source-op" }),
        makeNode("target", "operation", { operationId: "target-op" }),
      ],
      edges: [edge],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('onFail is "fail"');
    expect(runPrompt).toHaveBeenCalledTimes(1);
  });

  it("rejects onFail 'retry' up front instead of running it with wrong semantics", async () => {
    const runPrompt = vi.fn().mockReturnValue(okAsync("anything"));
    const deps = makeTestDeps({ runPrompt });
    const edge = {
      ...makeEdge("source", "target"),
      data: {
        label: "gated",
        qualityGate: { criteria: "approved", onFail: "retry", maxRetries: 2 },
      },
    } as PipelineEdge;

    const result = await executeScenario({
      deps,
      operations: new Map([
        ["source-op", makePromptOperation("source-op")],
        ["target-op", makePromptOperation("target-op")],
      ]),
      nodes: [
        makeNode("source", "operation", { operationId: "source-op" }),
        makeNode("target", "operation", { operationId: "target-op" }),
      ],
      edges: [edge],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("not supported");
    expect(runPrompt).not.toHaveBeenCalled();
  });
});

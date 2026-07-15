import { describe, expect, it, vi } from "vitest";
import type { PipelineEdge, PipelineNode } from "@repo/schemas";
import type { NodeCtx } from "../../schemas";
import { processDecisionNode, type ProcessDecisionNodeArgs } from "./DecisionNode";

vi.mock("@repo/obs", () => ({ trace: vi.fn().mockResolvedValue(undefined) }));

const decisionNode: PipelineNode = {
  id: "decision",
  type: "decision",
  position: { x: 0, y: 0 },
  data: { label: "Pick", nodeType: "decision", selectMode: "single" },
};

const edge = (source: string): PipelineEdge => ({
  id: `${source}-decision`,
  source,
  target: "decision",
});

const makeArgs = (
  nodeOutputs: Map<string, NodeCtx>,
  overrides: Partial<ProcessDecisionNodeArgs> = {},
): ProcessDecisionNodeArgs => ({
  node: decisionNode,
  jobId: "job-1",
  edges: [edge("a"), edge("b")],
  nodeOutputs,
  isEdgeActive: async () => true,
  applyEdgeTransform: (_edge, input) => input,
  nodeLabel: (id) => `label-${id}`,
  selectMode: "single",
  waitForDecision: async () => ({ selectedNodeIds: ["b"] }),
  emitStatus: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

const seedTwoCandidates = (): Map<string, NodeCtx> =>
  new Map<string, NodeCtx>([
    ["a", { inputPath: "/a", content: "variant A" }],
    ["b", { inputPath: "/b", content: "variant B" }],
  ]);

describe("processDecisionNode", () => {
  it("writes the chosen candidate's content as the node output (downstream reads it)", async () => {
    const outputs = seedTwoCandidates();
    const result = await processDecisionNode(makeArgs(outputs));

    expect(result.outcome).toBe("completed");
    expect(outputs.get("decision")?.content).toBe("variant B");
    expect(outputs.get("decision")?.inputPath).toBe("/b");
  });

  it("joins multiple selected candidates in multi-select", async () => {
    const outputs = seedTwoCandidates();
    const result = await processDecisionNode(
      makeArgs(outputs, {
        selectMode: "multi",
        waitForDecision: async () => ({ selectedNodeIds: ["a", "b"] }),
      }),
    );

    expect(result.outcome).toBe("completed");
    expect(outputs.get("decision")?.content).toBe("variant A\n\n---\n\nvariant B");
  });

  it("passes all active candidates (with labels) to the decision handler", async () => {
    const outputs = seedTwoCandidates();
    const waitForDecision = vi.fn().mockResolvedValue({ selectedNodeIds: ["a"] });
    await processDecisionNode(makeArgs(outputs, { waitForDecision }));

    expect(waitForDecision).toHaveBeenCalledTimes(1);
    const event = waitForDecision.mock.calls[0]![0];
    expect(event.candidates).toHaveLength(2);
    expect(event.candidates.map((c: { nodeId: string }) => c.nodeId)).toEqual(["a", "b"]);
    expect(event.candidates[0].label).toBe("label-a");
  });

  it("excludes inactive edges from candidates", async () => {
    const outputs = seedTwoCandidates();
    const waitForDecision = vi.fn().mockResolvedValue({ selectedNodeIds: ["a"] });
    await processDecisionNode(
      makeArgs(outputs, {
        isEdgeActive: async (e) => e.source === "a",
        waitForDecision,
      }),
    );

    const event = waitForDecision.mock.calls[0]![0];
    expect(event.candidates.map((c: { nodeId: string }) => c.nodeId)).toEqual(["a"]);
  });

  it("fails without a decision handler — never auto-selects the first candidate", async () => {
    const outputs = seedTwoCandidates();
    const result = await processDecisionNode(makeArgs(outputs, { waitForDecision: undefined }));

    expect(result.outcome).toBe("failed");
    expect(outputs.has("decision")).toBe(false);
  });

  it("fails when the user resolves with no selection (no silent fallback)", async () => {
    const outputs = seedTwoCandidates();
    const result = await processDecisionNode(
      makeArgs(outputs, { waitForDecision: async () => ({ selectedNodeIds: [] }) }),
    );

    expect(result.outcome).toBe("failed");
    expect(outputs.has("decision")).toBe(false);
  });
});

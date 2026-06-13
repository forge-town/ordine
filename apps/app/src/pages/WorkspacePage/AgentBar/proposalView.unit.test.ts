import { describe, expect, it } from "vitest";
import type { PipelineActionProposal } from "@repo/schemas";
import { buildProposeReply, createProposalSnapshot } from "./proposalView";

// 简化的 t：回显 key 并附插值，方便断言。
const t = ((key: string) => key) as unknown as Parameters<typeof buildProposeReply>[0]["t"];

const proposal = {
  summary: "add a node",
  actions: [
    { type: "addNode", node: { id: "n1", type: "operation", data: { label: "X" } } },
    { type: "addEdge", edge: { id: "e1", source: "n1", target: "n2" } },
  ],
} as unknown as PipelineActionProposal;

describe("createProposalSnapshot", () => {
  it("collects added node and edge ids", () => {
    expect(createProposalSnapshot(proposal)).toEqual({ addedEdges: ["e1"], addedNodes: ["n1"] });
  });
});

describe("buildProposeReply", () => {
  it("appends dropped-proposal note when error has a base reply", () => {
    const reply = buildProposeReply({
      baseReply: "hi",
      proposal: null,
      proposeError: { code: "BAD_AGENT_OUTPUT" },
      t,
    });
    expect(reply).toBe("hi\nworkspace.agentBar.errors.proposalDropped");
  });

  it("uses coded error key when no base reply", () => {
    const reply = buildProposeReply({
      baseReply: undefined,
      proposal: null,
      proposeError: { code: "RUNTIME_NOT_FOUND" },
      t,
    });
    expect(reply).toBe("workspace.agentBar.errors.RUNTIME_NOT_FOUND");
  });

  it("falls back to drafted / noSafeChange based on proposal presence", () => {
    expect(buildProposeReply({ baseReply: null, proposal, proposeError: null, t })).toBe(
      "workspace.agentBar.replies.drafted",
    );
    expect(buildProposeReply({ baseReply: null, proposal: null, proposeError: null, t })).toBe(
      "workspace.agentBar.replies.noSafeChange",
    );
  });

  it("prefers the agent's own reply when present", () => {
    expect(
      buildProposeReply({ baseReply: "custom answer", proposal, proposeError: null, t }),
    ).toBe("custom answer");
  });
});

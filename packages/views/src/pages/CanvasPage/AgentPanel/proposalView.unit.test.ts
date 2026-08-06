import { describe, expect, it } from "vitest";
import type { PipelineActionProposal } from "@repo/schemas";
import { buildProposalItems, createProposalSnapshot } from "./proposalView";

const t = ((key: string) => key) as never;

const proposal = {
  summary: "add a node",
  actions: [
    {
      type: "addNode",
      node: {
        id: "n1",
        type: "operation",
        data: { label: "X", operationId: "op-1", loopEnabled: true, maxLoopCount: 2 },
      },
    },
    { type: "addEdge", edge: { id: "e1", source: "n1", target: "n2" } },
  ],
} as unknown as PipelineActionProposal;

describe("proposalView", () => {
  it("collects added node and edge ids", () => {
    expect(createProposalSnapshot(proposal)).toEqual({ addedEdges: ["e1"], addedNodes: ["n1"] });
  });

  it("maps proposal actions without inventing pending operation badges", () => {
    expect(buildProposalItems(proposal, [], t)).toEqual([
      {
        badges: [{ label: "canvas.agentPanel.proposalDetails.loopBadge", tone: "accent" }],
        detail: "X",
        title: "canvas.agentPanel.proposalDetails.actionTitles.addNode",
      },
      {
        badges: [],
        detail: "n1 -> n2",
        title: "canvas.agentPanel.proposalDetails.actionTitles.addEdge",
      },
    ]);
  });
});

import { describe, expect, it } from "vitest";
import type { PipelineGraphSnapshot } from "@repo/schemas";
import { buildProposeUserPrompt, resolveSelectedElements } from "./buildProposePrompt";

const snapshot: PipelineGraphSnapshot = {
  nodes: [
    {
      id: "n1",
      type: "prompt",
      position: { x: 0, y: 0 },
      data: { nodeType: "prompt", label: "Quiz prompt", prompt: "Write a quiz" },
    },
    {
      id: "vc",
      type: "operation",
      position: { x: 400, y: 0 },
      data: {
        nodeType: "operation",
        label: "Verify child",
        operationId: "op_1",
        operationName: "Verify",
        status: "idle",
      },
    },
  ],
  edges: [{ id: "e1", source: "n1", target: "vc" }],
} as PipelineGraphSnapshot;

const basePromptInput = {
  attachments: [],
  message: "Change the prompt wording",
  operationCatalog: [],
  pipelineId: "p1",
  pipelineName: "Quiz pipeline",
  snapshot,
};

describe("resolveSelectedElements", () => {
  it("resolves a root node ref", () => {
    const { missing, resolved } = resolveSelectedElements(["n1"], snapshot);

    expect(missing).toEqual([]);
    expect(resolved).toHaveLength(1);
    expect(resolved[0]).toMatchObject({ drillPath: [], kind: "node", refId: "n1" });
    expect(resolved[0]?.element).toMatchObject({ id: "n1" });
  });

  it("resolves an edge ref", () => {
    const { missing, resolved } = resolveSelectedElements(["e1"], snapshot);

    expect(missing).toEqual([]);
    expect(resolved[0]).toMatchObject({ drillPath: [], kind: "edge", refId: "e1" });
    expect(resolved[0]?.element).toMatchObject({ source: "n1", target: "vc" });
  });

  it("resolves a drill-in ref by its last path segment and keeps the drill path", () => {
    const { missing, resolved } = resolveSelectedElements(["n4/vc"], snapshot);

    expect(missing).toEqual([]);
    expect(resolved[0]).toMatchObject({ drillPath: ["n4"], kind: "node", refId: "n4/vc" });
    expect(resolved[0]?.element).toMatchObject({ id: "vc" });
  });

  it("collects unknown refs as missing", () => {
    const { missing, resolved } = resolveSelectedElements(["ghost"], snapshot);

    expect(resolved).toEqual([]);
    expect(missing).toEqual(["ghost"]);
  });
});

describe("buildProposeUserPrompt history block", () => {
  it("injects conversation history before the user request", () => {
    const prompt = buildProposeUserPrompt({
      ...basePromptInput,
      history: [
        { content: "add a verify step", hasProposal: false, role: "user" },
        { content: "Drafted it.", hasProposal: true, role: "agent" },
      ],
    });

    expect(prompt).toContain("=== CONVERSATION HISTORY (oldest first) ===");
    expect(prompt).toContain("[user]: add a verify step");
    expect(prompt).toContain("[assistant] (included a graph proposal): Drafted it.");
    expect(prompt.indexOf("=== CONVERSATION HISTORY")).toBeLessThan(
      prompt.indexOf("=== USER REQUEST ==="),
    );
  });

  it("omits the history block when the conversation is empty", () => {
    const prompt = buildProposeUserPrompt(basePromptInput);

    expect(prompt).not.toContain("=== CONVERSATION HISTORY");
  });
});

describe("buildProposeUserPrompt diagnostics block", () => {
  it("injects diagnostics and the failed proposal for a fix round", () => {
    const prompt = buildProposeUserPrompt({
      ...basePromptInput,
      diagnostics: ['Operation node "op-x" references unknown operationId "ghost".'],
      failedProposal: { summary: "broken", actions: [{ type: "removeNode", nodeId: "nx" }] },
    });

    expect(prompt).toContain("=== PREVIOUS PROPOSAL DIAGNOSTICS ===");
    expect(prompt).toContain('- Operation node "op-x" references unknown operationId "ghost".');
    expect(prompt).toContain("Failed proposal for reference:");
    expect(prompt).toContain('"summary": "broken"');
    expect(prompt.indexOf("=== PREVIOUS PROPOSAL DIAGNOSTICS")).toBeLessThan(
      prompt.indexOf("=== USER REQUEST ==="),
    );
  });

  it("omits the diagnostics block when there are none", () => {
    const prompt = buildProposeUserPrompt(basePromptInput);

    expect(prompt).not.toContain("=== PREVIOUS PROPOSAL DIAGNOSTICS");
  });
});

describe("buildProposeUserPrompt selection block", () => {
  it("omits the selection block when nothing is referenced", () => {
    const prompt = buildProposeUserPrompt(basePromptInput);

    expect(prompt).not.toContain("=== USER SELECTION ===");
  });

  it("includes selected element JSON and targeting instruction", () => {
    const prompt = buildProposeUserPrompt({
      ...basePromptInput,
      referencedNodeIds: ["n1"],
    });

    expect(prompt).toContain("=== USER SELECTION ===");
    expect(prompt).toContain('"refId": "n1"');
    expect(prompt).toContain("Treat the user's request as targeting these elements.");
    expect(prompt.indexOf("=== USER SELECTION ===")).toBeLessThan(
      prompt.indexOf("=== USER REQUEST ==="),
    );
  });

  it("lists unknown refs so the agent can ignore them", () => {
    const prompt = buildProposeUserPrompt({
      ...basePromptInput,
      referencedNodeIds: ["ghost"],
    });

    expect(prompt).toContain("Referenced ids not found in the current graph");
    expect(prompt).toContain("ghost");
  });
});

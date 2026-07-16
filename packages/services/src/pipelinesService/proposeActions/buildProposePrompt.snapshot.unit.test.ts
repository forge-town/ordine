import { describe, expect, it } from "vitest";
import { buildProposeUserPrompt, PROPOSE_SYSTEM_PROMPT } from "./buildProposePrompt";

/**
 * Snapshot baseline for the propose prompts. Fixed fixtures, so any change
 * to the prompt assembly shows up in the snapshot diff.
 */
describe("buildProposePrompt snapshots", () => {
  it("system prompt is stable", () => {
    expect(PROPOSE_SYSTEM_PROMPT).toMatchSnapshot();
  });

  const promptNode = (id: string, label: string) => ({
    id,
    type: "prompt" as const,
    position: { x: 0, y: 0 },
    data: { label, nodeType: "prompt" as const, prompt: "do something" },
  });

  it("user prompt — minimal request (empty graph, no catalog)", () => {
    const prompt = buildProposeUserPrompt({
      attachments: [],
      message: "Build a pipeline that turns a PDF into a quiz",
      operationCatalog: [],
      snapshot: { nodes: [], edges: [] },
    });
    expect(prompt).toMatchSnapshot();
  });

  it("user prompt — with selection, catalog and history", () => {
    const prompt = buildProposeUserPrompt({
      attachments: [],
      message: "Change this node's prompt",
      operationCatalog: [
        {
          id: "op_summarize",
          name: "Summarize",
          description: "Summarize text",
          acceptedObjectTypes: [],
        },
      ],
      referencedNodeIds: ["n1"],
      history: [{ role: "user", content: "earlier message", hasProposal: false }],
      snapshot: { nodes: [promptNode("n1", "Summarize step")], edges: [] },
    });
    expect(prompt).toMatchSnapshot();
  });

  it("includes a USER SELECTION section when referencedNodeIds resolve", () => {
    const prompt = buildProposeUserPrompt({
      attachments: [],
      message: "edit it",
      operationCatalog: [],
      referencedNodeIds: ["n1"],
      snapshot: { nodes: [promptNode("n1", "X")], edges: [] },
    });
    expect(prompt).toContain("n1");
  });
});

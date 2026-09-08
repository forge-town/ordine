import { describe, expect, it } from "vitest";
import type { AgentContextEnvelope } from "@repo/schemas";
import { buildAgentControlPrompt } from "../../src/routes/agentControlPrompt";

const context: AgentContextEnvelope = {
  route: { pathname: "/canvas", label: "Canvas" },
  projectId: "project-1",
  pipelineId: "pipeline-1",
  selectedResources: [{ type: "pipeline", id: "pipeline-1", label: "Large graph" }],
  selectedNodeIds: ["selected-node"],
  attachments: [],
  activeRun: null,
  capturedAt: "2026-08-25T00:00:00.000Z",
};

const promptWithAccidentalSnapshot = (nodeCount: number) =>
  buildAgentControlPrompt({
    threadId: "thread-1",
    message: "Inspect and improve this Pipeline",
    context: {
      ...context,
      nodes: Array.from({ length: nodeCount }, (_, index) => ({ id: `secret-node-${index}` })),
      edges: Array.from({ length: nodeCount }, (_, index) => ({ id: `secret-edge-${index}` })),
    } as AgentContextEnvelope,
  });

describe("buildAgentControlPrompt", () => {
  it("keeps the initial prompt independent of a 200 or 2,000 node Canvas snapshot", () => {
    const small = promptWithAccidentalSnapshot(200);
    const large = promptWithAccidentalSnapshot(2_000);

    expect(large).toEqual(small);
    expect(large.prompt).not.toContain('"nodes":');
    expect(large.prompt).not.toContain('"edges":');
    expect(large.prompt).not.toContain("secret-node-");
    expect(large.prompt).not.toContain("secret-edge-");
  });

  it("requires semantic input coverage in addition to structural Canvas validation", () => {
    const result = promptWithAccidentalSnapshot(0);

    expect(result.systemPrompt).toContain("validate_canvas only proves structural validity");
    expect(result.systemPrompt).toContain("localPath is an output directory");
    expect(result.systemPrompt).toContain("outputFileName");
  });
});

import { describe, expect, it } from "vitest";
import { sanitizeGeneratedGraph } from "./sanitizeGeneratedGraph.helper";
describe("sanitizeGeneratedGraph", () => {
  it("retains the Pipeline content and error boundary", () => {
    const original = {
      nodes: [
        {
          type: "github-projects",
          data: { nodeType: "github-projects", repo: "owner/repository" },
        },
        { type: "prompt", data: { nodeType: "prompt", description: "Review content", prompt: "" } },
      ],
    };
    expect(sanitizeGeneratedGraph(original)).toEqual({
      nodes: [
        {
          type: "github-project",
          data: { nodeType: "github-project", owner: "owner", repo: "repository" },
        },
        {
          type: "prompt",
          data: { nodeType: "prompt", description: "Review content", prompt: "Review content" },
        },
      ],
    });
    expect(original.nodes[0]?.data.nodeType).toBe("github-projects");
    expect(sanitizeGeneratedGraph(null)).toBeNull();
  });
});

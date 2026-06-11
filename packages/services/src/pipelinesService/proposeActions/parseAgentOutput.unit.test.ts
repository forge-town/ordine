import { describe, expect, it } from "vitest";
import { parseProposeAgentOutput } from "./parseAgentOutput";

describe("parseProposeAgentOutput", () => {
  it("parses the new format with a nested proposal", () => {
    const output = parseProposeAgentOutput({
      reply: "I added a verify step.",
      proposal: { summary: "Add verify", actions: [{ type: "removeNode", nodeId: "n1" }] },
    });

    expect(output.reply).toBe("I added a verify step.");
    expect(output.clarifyOptions).toEqual([]);
    expect(output.proposalPayload).toEqual({
      summary: "Add verify",
      actions: [{ type: "removeNode", nodeId: "n1" }],
    });
  });

  it("parses a clarify-only response and caps options at four", () => {
    const output = parseProposeAgentOutput({
      reply: "Which input should I use?",
      clarifyOptions: [" Folder ", "GitHub repo", "Prompt text", "Sample file", "Fifth option"],
      proposal: null,
    });

    expect(output.reply).toBe("Which input should I use?");
    expect(output.clarifyOptions).toEqual([
      "Folder",
      "GitHub repo",
      "Prompt text",
      "Sample file",
    ]);
    expect(output.proposalPayload).toBeNull();
  });

  it("synthesizes a proposal from top-level actions next to a reply", () => {
    const output = parseProposeAgentOutput({
      reply: "Removed the stale node.",
      actions: [{ type: "removeNode", nodeId: "n1" }],
    });

    expect(output.proposalPayload).toEqual({
      actions: [{ type: "removeNode", nodeId: "n1" }],
      summary: "Removed the stale node.",
    });
  });

  it("treats the legacy {summary, actions} format as the proposal payload", () => {
    const legacy = { summary: "remove node", actions: [{ type: "removeNode", nodeId: "n1" }] };
    const output = parseProposeAgentOutput(legacy);

    expect(output.reply).toBeNull();
    expect(output.proposalPayload).toBe(legacy);
  });

  it("drops non-string clarify options", () => {
    const output = parseProposeAgentOutput({
      reply: "Pick one",
      clarifyOptions: ["valid", 42, "", null],
      proposal: null,
    });

    expect(output.clarifyOptions).toEqual(["valid"]);
  });
});

import { describe, expect, it } from "vitest";
import { PipelineActionSchema } from "./PipelineActionSchema";

describe("PipelineActionSchema", () => {
  it("accepts a complete updateOperation executor", () => {
    const result = PipelineActionSchema.safeParse({
      type: "updateOperation",
      operationId: "op-review",
      executor: {
        type: "agent",
        agentMode: "prompt",
        agent: "codex",
        model: "gpt-5.4-mini",
        prompt: "Review the supplied change.",
        allowedTools: ["Read"],
        assignmentReason: "Read-only repository access is sufficient for review.",
      },
    });

    expect(result.success).toBe(true);
  });

  it("rejects multiline reasons and unknown executor fields", () => {
    expect(
      PipelineActionSchema.safeParse({
        type: "updateOperation",
        operationId: "op-review",
        executor: {
          type: "agent",
          assignmentReason: "First line\nsecond line",
        },
      }).success,
    ).toBe(false);

    expect(
      PipelineActionSchema.safeParse({
        type: "updateOperation",
        operationId: "op-review",
        executor: { type: "script", command: "bun run lint", unexpected: true },
      }).success,
    ).toBe(false);
  });
});

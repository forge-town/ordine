import { describe, expect, it } from "vitest";
import { createBuildGenerationDescriptionHelper } from "./buildGenerationDescription.helper";
import { PipelineAgentProposalSchema } from "@repo/schemas";
describe("buildGenerationDescription", () => {
  it("retains the planning and attachment boundary", () => {
    const proposal = PipelineAgentProposalSchema.parse({
      mode: "generate",
      purpose: "Review",
      inputs: [],
      outputs: ["report"],
      majorOperations: ["review"],
      executionFlow: ["input -> review -> report"],
      assumptions: [],
      openQuestions: [],
      readiness: "ready_for_generation",
      schedule: { cronExpression: "0 9 * * 1-5", enabled: true },
    });
    if (proposal.mode !== "generate") throw new Error("fixture mode");
    const description = createBuildGenerationDescriptionHelper({})(proposal);
    expect(description).toContain("Purpose: Review");
    expect(description).toContain("Schedule metadata (do not create an Operation): 0 9 * * 1-5");
    expect(description).toContain("Inputs: (none)");
  });
});

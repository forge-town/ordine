import { describe, expect, it } from "vitest";
import { PipelineGenerationPlanSchema } from "./PipelineGenerationPlanSchema";

const basePlan = {
  mode: "generate" as const,
  purpose: "Review the repository",
  inputs: ["repository"],
  outputs: ["report"],
  majorOperations: ["review-code"],
  executionFlow: ["repository -> review-code -> report"],
  assumptions: [],
  openQuestions: [],
  readiness: "ready_for_generation" as const,
};

describe("PipelineGenerationPlanSchema schedule", () => {
  it("accepts a valid optional recurring schedule", () => {
    expect(
      PipelineGenerationPlanSchema.parse({
        ...basePlan,
        schedule: { cronExpression: "0 9 * * 1-5" },
      }).schedule,
    ).toEqual({ cronExpression: "0 9 * * 1-5", enabled: true });
  });

  it("rejects a malformed schedule before proposal approval", () => {
    expect(
      PipelineGenerationPlanSchema.safeParse({
        ...basePlan,
        schedule: { cronExpression: "every weekday" },
      }).success,
    ).toBe(false);
  });
});

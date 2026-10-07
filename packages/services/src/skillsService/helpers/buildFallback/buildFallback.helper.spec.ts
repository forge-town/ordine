import { describe, expect, it } from "vitest";
import { createBuildFallbackHelper } from "./buildFallback.helper";
import { SkillSchema } from "@repo/schemas";
describe("buildFallback", () => {
  it("preserves skill import and analysis metadata", () => {
    const skill = SkillSchema.parse({
      id: "skill-1",
      name: "review",
      label: "Review Code",
      description: "Review evidence",
      category: "code",
      tags: [],
    });
    const result = createBuildFallbackHelper()(skill);
    expect(result).toMatchObject({
      skillType: "single-step",
      steps: [{ name: "Review Code", description: "Review evidence", suggestedOutputs: [] }],
    });
  });
});

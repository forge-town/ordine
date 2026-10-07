import { describe, expect, it } from "vitest";
import { CheckOutputSchema, FixOutputSchema } from "@repo/agent";
import { createSkillExecutorBuildSkillUserPromptHelper } from "./skillExecutorBuildSkillUserPrompt.helper";
describe("skillExecutorBuildSkillUserPrompt", () => {
  it("retains the source evidence and skill instruction in the rendered prompt", () => {
    const build = createSkillExecutorBuildSkillUserPromptHelper({
      CHECK_OUTPUT_EXAMPLE: CheckOutputSchema.parse({
        type: "check",
        summary: "Review",
        findings: [],
        stats: { totalFiles: 0, totalFindings: 0, errors: 0, warnings: 0, infos: 0, skipped: 0 },
      }),
      FIX_OUTPUT_EXAMPLE: FixOutputSchema.parse({
        type: "fix",
        summary: "Fix",
        changes: [],
        remainingFindings: [],
        stats: { totalChanges: 0, filesModified: 0, findingsFixed: 0, findingsSkipped: 0 },
      }),
    });
    const prompt = build({
      skillId: "review",
      skillDescription: "Review evidence",
      inputPath: "/workspace",
      inputContent: "source evidence",
    });
    expect(prompt).toContain("Skill ID: review");
    expect(prompt).toContain("Review evidence");
    expect(prompt).toContain("source evidence");
  });
});

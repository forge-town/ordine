import { type SkillAnalysisResult, type Skill } from "@repo/schemas";

export const createBuildFallbackHelper =
  () =>
  (skill: Skill): SkillAnalysisResult => ({
    skillType: "single-step",
    steps: [{ name: skill.label, description: skill.description, suggestedOutputs: [] }],
    rationale: "Analysis failed; falling back to single-step",
  });

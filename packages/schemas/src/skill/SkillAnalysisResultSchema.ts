import { z } from "zod/v4";
import { TemplateContentTypeSchema } from "../operation/TemplateContentTypeSchema";

export const SkillAnalysisStepSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  suggestedOutputs: z
    .array(
      z.object({
        name: z.string(),
        contentType: TemplateContentTypeSchema,
      }),
    )
    .optional()
    .default([]),
});

export const SkillAnalysisResultSchema = z.object({
  skillType: z.enum(["single-step", "multi-step"]),
  steps: z.array(SkillAnalysisStepSchema),
  rationale: z.string(),
});

export type SkillAnalysisResult = z.infer<typeof SkillAnalysisResultSchema>;
export type SkillAnalysisStep = z.infer<typeof SkillAnalysisStepSchema>;

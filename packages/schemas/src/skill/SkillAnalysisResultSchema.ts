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

export const SkillAnalysisResultSchema = z
  .object({
    skillType: z.enum(["single-step", "multi-step"]),
    steps: z.array(SkillAnalysisStepSchema).min(1),
    rationale: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.skillType === "multi-step" && data.steps.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.too_small,
        minimum: 2,
        type: "array",
        inclusive: true,
        message: "multi-step skill must have at least 2 steps",
        path: ["steps"],
      });
    }
  });

export type SkillAnalysisResult = z.infer<typeof SkillAnalysisResultSchema>;
export type SkillAnalysisStep = z.infer<typeof SkillAnalysisStepSchema>;

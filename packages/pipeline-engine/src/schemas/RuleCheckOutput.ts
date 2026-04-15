import { z } from "zod/v4";

export const RuleCheckOutputSchema = z
  .object({
    stats: z.object({
      totalFindings: z.number(),
      totalFiles: z.number(),
    }),
  })
  .passthrough();
export type RuleCheckOutput = z.infer<typeof RuleCheckOutputSchema>;

import { z } from "zod/v4";

export const RuleTargetSchema = z.object({
  path: z.string(),
  type: z.enum(["file", "folder", "project"]),
});
export type RuleTarget = z.infer<typeof RuleTargetSchema>;

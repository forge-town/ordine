import { z } from "zod/v4";

export const RuleCategorySchema = z.enum([
  "lint",
  "security",
  "style",
  "performance",
  "structure",
  "testing",
  "custom",
]);
export type RuleCategory = z.infer<typeof RuleCategorySchema>;

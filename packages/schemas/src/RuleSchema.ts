import { z } from "zod/v4";
import { RuleCategorySchema } from "./RuleCategorySchema";
import { RuleSeveritySchema } from "./RuleSeveritySchema";
import { RuleScriptLanguageSchema } from "./RuleScriptLanguageSchema";
import { ObjectTypeSchema } from "./ObjectTypeSchema";
import { MetaSchema } from "./meta";

export const RuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  category: RuleCategorySchema,
  severity: RuleSeveritySchema,
  checkScript: z.string().nullable(),
  scriptLanguage: RuleScriptLanguageSchema.nullable(),
  acceptedObjectTypes: z.array(ObjectTypeSchema).default(["file", "folder", "project"]),
  enabled: z.boolean(),
  tags: z.array(z.string()),
  meta: MetaSchema.optional(),
});
export type Rule = z.infer<typeof RuleSchema>;

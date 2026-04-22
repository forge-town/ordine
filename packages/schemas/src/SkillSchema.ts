import { z } from "zod/v4";
import { MetaSchema } from "./meta";

export const SkillSchema = z.object({
  id: z.string(),
  name: z.string(),
  label: z.string(),
  description: z.string(),
  category: z.string(),
  tags: z.array(z.string()),
  meta: MetaSchema.optional(),
});
export type Skill = z.infer<typeof SkillSchema>;

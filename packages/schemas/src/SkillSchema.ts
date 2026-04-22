import { z } from "zod/v4";

export const SkillSchema = z.object({
  id: z.string(),
  name: z.string(),
  label: z.string(),
  description: z.string(),
  category: z.string(),
  tags: z.array(z.string()),
});
export type Skill = z.infer<typeof SkillSchema>;

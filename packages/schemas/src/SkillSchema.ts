import { z } from "zod/v4";

export const SkillSchema = z.object({
  id: z.string(),
  name: z.string(),
  label: z.string(),
  description: z.string(),
  category: z.string(),
  tags: z.array(z.string()),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Skill = z.infer<typeof SkillSchema>;

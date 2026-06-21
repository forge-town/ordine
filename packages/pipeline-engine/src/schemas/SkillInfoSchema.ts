import { z } from "zod/v4";

export const SkillInfoSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
});
export type SkillInfo = z.infer<typeof SkillInfoSchema>;

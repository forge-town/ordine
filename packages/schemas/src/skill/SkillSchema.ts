import { z } from "zod/v4";
import { MetaSchema } from "../meta";
import { CapabilityOriginSchema, CapabilitySourceSchema } from "../capability";

export const SkillSchema = z.object({
  id: z.string(),
  name: z.string(),
  label: z.string(),
  description: z.string(),
  category: z.string(),
  tags: z.array(z.string()),
  origin: CapabilityOriginSchema.default("manual"),
  sources: z.array(CapabilitySourceSchema).default([]),
  meta: MetaSchema.optional(),
});
export type Skill = z.infer<typeof SkillSchema>;

export const CreateSkillSchema = SkillSchema.omit({
  origin: true,
  sources: true,
  meta: true,
});
export type CreateSkillInput = z.infer<typeof CreateSkillSchema>;

export const UpdateSkillSchema = CreateSkillSchema.omit({ id: true }).partial();
export type UpdateSkillInput = z.infer<typeof UpdateSkillSchema>;

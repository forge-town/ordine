import { z } from "zod/v4";

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().default(""),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Project = z.infer<typeof ProjectSchema>;

export const CreateProjectSchema = ProjectSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

export const UpdateProjectSchema = CreateProjectSchema.partial();
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;

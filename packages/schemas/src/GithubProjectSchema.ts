import { z } from "zod/v4";

export const GithubProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().default(""),
  owner: z.string(),
  repo: z.string(),
  branch: z.string().default("main"),
  githubUrl: z.string(),
  isPrivate: z.boolean().default(false),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type GithubProject = z.infer<typeof GithubProjectSchema>;

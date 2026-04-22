import { z } from "zod/v4";
import { MetaSchema } from "./meta";

export const GithubProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().default(""),
  owner: z.string(),
  repo: z.string(),
  branch: z.string().default("main"),
  githubUrl: z.string(),
  isPrivate: z.boolean().default(false),
  meta: MetaSchema,
});
export type GithubProject = z.infer<typeof GithubProjectSchema>;

import { z } from "zod/v4";

export const GitHubRemoteSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  branch: z.string(),
});
export type GitHubRemote = z.infer<typeof GitHubRemoteSchema>;

export const NodeCtxSchema = z.object({
  inputPath: z.string(),
  content: z.string(),
  githubRemote: GitHubRemoteSchema.optional(),
});
export type NodeCtx = z.infer<typeof NodeCtxSchema>;

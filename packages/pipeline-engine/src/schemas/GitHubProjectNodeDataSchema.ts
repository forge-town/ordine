import { z } from "zod/v4";
import { DisclosureModeSchema } from "./DisclosureModeSchema.js";

export const GitHubProjectNodeDataSchema = z.object({
  label: z.string(),
  nodeType: z.literal("github-project"),
  sourceType: z.enum(["github", "local"]).optional(),
  owner: z.string(),
  repo: z.string(),
  branch: z.string().optional(),
  description: z.string().optional(),
  isPrivate: z.boolean().optional(),
  githubProjectId: z.string().optional(),
  localPath: z.string().optional(),
  disclosureMode: DisclosureModeSchema.optional(),
  excludedPaths: z.array(z.string()).optional(),
});
export type GitHubProjectNodeData = z.infer<typeof GitHubProjectNodeDataSchema>;

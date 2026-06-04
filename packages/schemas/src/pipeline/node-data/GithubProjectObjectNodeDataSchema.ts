import { z } from "zod/v4";
import { DisclosureModeSchema } from "./DisclosureModeSchema";

export const SOURCE_TYPE_ENUM = {
  GITHUB: "github",
  LOCAL: "local",
} as const;

export const SourceTypeSchema = z.enum(SOURCE_TYPE_ENUM);
export type SourceType = z.infer<typeof SourceTypeSchema>;

export const GithubProjectObjectNodeDataSchema = z.object({
  label: z.string(),
  nodeType: z.literal("github-project"),
  sourceType: SourceTypeSchema.optional(),
  accessMode: z.enum(["clone", "remote"]).optional(),
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
export type GithubProjectObjectNodeData = z.infer<typeof GithubProjectObjectNodeDataSchema>;

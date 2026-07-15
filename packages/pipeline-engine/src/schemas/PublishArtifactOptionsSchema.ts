import { z } from "zod/v4";
import { PublishTargetSchema } from "@repo/schemas";

export const PublishArtifactOptionsSchema = z.object({
  /** Source directory to publish (the operation's resolved outputDir, where the upstream agent wrote files). */
  sourceDir: z.string(),
  target: PublishTargetSchema,
  /** git: owner/repo or full URL; localDir: target directory path. */
  repo: z.string(),
  /** git: base branch for the PR; ignored for localDir. */
  branch: z.string().optional(),
  /** Subpath inside the target repo/directory to write into. */
  subPath: z.string().optional(),
  commitMessage: z.string().optional(),
  /** git: whether to open a PR (defaults to true; never pushes directly to the default branch). */
  openPr: z.boolean().optional(),
  githubToken: z.string().optional(),
  jobId: z.string().optional(),
});
export type PublishArtifactOptions = z.infer<typeof PublishArtifactOptionsSchema> & {
  onProgress?: (line: string) => Promise<void>;
};

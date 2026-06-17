import { z } from "zod/v4";
import { PublishTargetSchema } from "@repo/schemas";

export const PublishArtifactOptionsSchema = z.object({
  /** 待发布的源目录（= operation 解析出的 outputDir，上游 agent 写文件处）。 */
  sourceDir: z.string(),
  target: PublishTargetSchema,
  /** git: owner/repo 或完整 URL；localDir: 目标目录路径。 */
  repo: z.string(),
  /** git 基分支（PR 的 base）；localDir 忽略。 */
  branch: z.string().optional(),
  /** 写入目标仓库/目录的子路径。 */
  subPath: z.string().optional(),
  commitMessage: z.string().optional(),
  /** git: 是否开 PR（默认开，永不直推默认分支）。 */
  openPr: z.boolean().optional(),
  githubToken: z.string().optional(),
  jobId: z.string().optional(),
});
export type PublishArtifactOptions = z.infer<typeof PublishArtifactOptionsSchema> & {
  onProgress?: (line: string) => Promise<void>;
};

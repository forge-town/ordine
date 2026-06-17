import { z } from "zod/v4";

export const PUBLISH_TARGET_ENUM = {
  /** 推到 git 仓库（PR 优先，不直推默认分支） */
  GIT: "git",
  /** 复制到本地目录 */
  LOCAL_DIR: "localDir",
} as const;
export const PublishTargetSchema = z.enum(PUBLISH_TARGET_ENUM);
export type PublishTarget = z.infer<typeof PublishTargetSchema>;

import { z } from "zod/v4";

export const ARTIFACT_KIND_ENUM = {
  /** content 字段即正文本身 */
  INLINE: "inline",
  /** content 字段是单个文件的本地路径 */
  FILE: "file",
  /** content 字段是目录路径，files 列出目录内文件清单 */
  DIR: "dir",
} as const;
export const ArtifactKindSchema = z.enum(ARTIFACT_KIND_ENUM);
export type ArtifactKind = z.infer<typeof ArtifactKindSchema>;

import { z } from "zod/v4";
import { TemplateContentTypeSchema } from "../operation/TemplateContentTypeSchema";
import { ArtifactFileSchema } from "./ArtifactFileSchema";
import { ArtifactKindSchema } from "./ArtifactKindSchema";

/**
 * 节点产物的轻量描述。不替代 NodeCtx 主通道（仍走单 string content），
 * 仅为前端预览 / 决策候选 / 发布提供「这是什么内容、在哪」的元数据。
 * - kind=inline：content 为正文
 * - kind=file ：content 为单文件路径
 * - kind=dir  ：content 为目录路径，files 为清单
 */
export const NodeArtifactSchema = z.object({
  kind: ArtifactKindSchema,
  contentType: TemplateContentTypeSchema,
  content: z.string().optional(),
  files: z.array(ArtifactFileSchema).optional(),
  label: z.string().optional(),
});
export type NodeArtifact = z.infer<typeof NodeArtifactSchema>;

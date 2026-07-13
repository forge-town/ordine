import { z } from "zod/v4";
import { TemplateContentTypeSchema } from "../operation/TemplateContentTypeSchema";

/** dir 工件中的单个文件描述（path 相对目录根） */
export const ArtifactFileSchema = z.object({
  path: z.string(),
  contentType: TemplateContentTypeSchema,
  sizeBytes: z.number().int().nonnegative().optional(),
});
export type ArtifactFile = z.infer<typeof ArtifactFileSchema>;

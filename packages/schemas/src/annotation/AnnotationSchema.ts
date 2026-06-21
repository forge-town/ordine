import { z } from "zod/v4";
import { AnnotationAuthorSchema } from "./AnnotationAuthorSchema";
import { AnnotationTargetTypeSchema } from "./AnnotationTargetTypeSchema";

export const AnnotationSchema = z.object({
  id: z.string(),
  pipelineId: z.string(),
  targetId: z.string(),
  targetType: AnnotationTargetTypeSchema,
  author: AnnotationAuthorSchema,
  content: z.string().min(1),
  resolved: z.boolean().default(false),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Annotation = z.infer<typeof AnnotationSchema>;

export const CreateAnnotationSchema = AnnotationSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CreateAnnotationInput = z.infer<typeof CreateAnnotationSchema>;

export const UpdateAnnotationSchema = CreateAnnotationSchema.partial();
export type UpdateAnnotationInput = z.infer<typeof UpdateAnnotationSchema>;

import { z } from "zod/v4";

export const ANNOTATION_TARGET_TYPE_ENUM = {
  NODE: "node",
  EDGE: "edge",
} as const;
export const AnnotationTargetTypeSchema = z.enum(ANNOTATION_TARGET_TYPE_ENUM);
export type AnnotationTargetType = z.infer<typeof AnnotationTargetTypeSchema>;

import { z } from "zod/v4";

export const ANNOTATION_AUTHOR_ENUM = {
  USER: "user",
  AGENT: "agent",
} as const;
export const AnnotationAuthorSchema = z.enum(ANNOTATION_AUTHOR_ENUM);
export type AnnotationAuthor = z.infer<typeof AnnotationAuthorSchema>;

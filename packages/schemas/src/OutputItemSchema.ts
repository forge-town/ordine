import { z } from "zod/v4";
import { TemplateContentTypeSchema } from "./TemplateContentTypeSchema";

export const OutputItemSchema = z.object({
  name: z.string(),
  contentType: TemplateContentTypeSchema,
  description: z.string().optional(),
  templateIds: z.array(z.string()).default([]),
});
export type OutputItem = z.infer<typeof OutputItemSchema>;

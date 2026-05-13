import { z } from "zod/v4";
import { TemplateContentTypeSchema } from "./TemplateContentTypeSchema";
import { MetaSchema } from "../meta";

export const OperationOutputItemTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().default(null),
  content: z.string(),
  contentType: TemplateContentTypeSchema,
  meta: MetaSchema.optional(),
});
export type OperationOutputItemTemplate = z.infer<typeof OperationOutputItemTemplateSchema>;

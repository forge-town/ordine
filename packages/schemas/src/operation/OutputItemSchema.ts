import { z } from "zod/v4";
import { TemplateContentTypeSchema } from "./TemplateContentTypeSchema";
import { ConcreteMediaTypeSchema } from "./MediaTypeSchema";
import { OperationPortCardinalitySchema } from "./OperationPortCardinalitySchema";

export const OutputItemSchema = z.object({
  /** Stable port ID. Older operations may omit it until they are edited. */
  id: z.string().min(1).optional(),
  name: z.string().min(1),
  contentType: TemplateContentTypeSchema,
  required: z.boolean().optional(),
  cardinality: OperationPortCardinalitySchema.optional(),
  /** Concrete MIME types the operation can write to this output port. */
  produces: z.array(ConcreteMediaTypeSchema).min(1).optional(),
  description: z.string().optional(),
  templateIds: z.array(z.string()).default([]),
});
export type OutputItem = z.infer<typeof OutputItemSchema>;

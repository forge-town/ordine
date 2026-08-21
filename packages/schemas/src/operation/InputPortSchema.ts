import { z } from "zod/v4";
import { ObjectNodeTypeSchema } from "../pipeline/node/ObjectNodeTypeSchema";
import { MediaTypePatternSchema } from "./MediaTypeSchema";
import { OperationPortCardinalitySchema } from "./OperationPortCardinalitySchema";

export const InputPortSchema = z.object({
  /** Stable port ID. Older operations may omit it until they are edited. */
  id: z.string().min(1).optional(),
  name: z.string().min(1),
  kind: ObjectNodeTypeSchema,
  required: z.boolean(),
  cardinality: OperationPortCardinalitySchema.optional(),
  /** MIME patterns accepted by this port, for example `text/markdown` or `image/*`. */
  accepts: z.array(MediaTypePatternSchema).min(1).optional(),
  description: z.string().optional(),
});
export type InputPort = z.infer<typeof InputPortSchema>;

import { z } from "zod/v4";
import { ObjectNodeTypeSchema } from "../pipeline/node/ObjectNodeTypeSchema";

export const InputPortSchema = z.object({
  name: z.string(),
  kind: ObjectNodeTypeSchema,
  required: z.boolean(),
  description: z.string().optional(),
});
export type InputPort = z.infer<typeof InputPortSchema>;

import { z } from "zod/v4";
import { OperationConfigSchema } from "./OperationConfigSchema";
import { ObjectNodeTypeSchema } from "../pipeline/node/ObjectNodeTypeSchema";
import { MetaSchema } from "../meta";

export const OperationSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().default(""),
  config: OperationConfigSchema,
  acceptedObjectTypes: z
    .array(ObjectNodeTypeSchema)
    .default(["file", "folder", "github-project", "prompt"]),
  meta: MetaSchema.optional(),
});
export type Operation = z.infer<typeof OperationSchema>;

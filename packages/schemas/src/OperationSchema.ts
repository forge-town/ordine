import { z } from "zod/v4";
import { OperationConfigSchema } from "./OperationConfigSchema";
import { ObjectTypeSchema } from "./ObjectTypeSchema";
import { MetaSchema } from "./meta";

export const OperationSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().default(null),
  config: OperationConfigSchema,
  acceptedObjectTypes: z.array(ObjectTypeSchema).default(["file", "folder", "project"]),
  meta: MetaSchema.optional(),
});
export type Operation = z.infer<typeof OperationSchema>;

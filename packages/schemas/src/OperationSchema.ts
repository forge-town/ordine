import { z } from "zod/v4";
import { OperationConfigSchema } from "@repo/pipeline-engine/schemas";
import { ObjectTypeSchema } from "./ObjectTypeSchema";

export const OperationSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().default(null),
  config: OperationConfigSchema,
  acceptedObjectTypes: z.array(ObjectTypeSchema).default(["file", "folder", "project"]),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Operation = z.infer<typeof OperationSchema>;

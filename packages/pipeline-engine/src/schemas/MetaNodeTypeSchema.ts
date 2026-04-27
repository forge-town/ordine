import { z } from "zod/v4";

export const META_NODE_TYPE_ENUM = {
  OBJECT: "object",
  OPERATION: "operation",
  OUTPUT: "output",
} as const;

export const MetaNodeTypeSchema = z.enum(META_NODE_TYPE_ENUM);
export type MetaNodeType = z.infer<typeof MetaNodeTypeSchema>;

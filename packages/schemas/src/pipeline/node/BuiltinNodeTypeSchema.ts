import { z } from "zod/v4";
import { OBJECT_NODE_TYPE_ENUM } from "./ObjectNodeTypeSchema";
import { OPERATION_NODE_TYPE_ENUM } from "./OperationNodeTypeSchema";
import { OUTPUT_NODE_TYPE_ENUM } from "./OutputNodeTypeSchema";

export const BUILTIN_NODE_TYPE_ENUM = {
  ...OBJECT_NODE_TYPE_ENUM,
  ...OPERATION_NODE_TYPE_ENUM,
  ...OUTPUT_NODE_TYPE_ENUM,
} as const;
export const BuiltinNodeTypeSchema = z.enum(BUILTIN_NODE_TYPE_ENUM);
export type BuiltinNodeType = z.infer<typeof BuiltinNodeTypeSchema>;

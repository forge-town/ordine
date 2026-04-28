import { z } from "zod/v4";

/**
 * Node type — accepts built-in types plus any plugin-registered string.
 * Use `BuiltinNodeTypeSchema` when you need strict built-in validation.
 */
export const NodeTypeSchema = z.string();
export type NodeType = string;

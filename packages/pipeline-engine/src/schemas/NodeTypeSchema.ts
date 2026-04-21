import { z } from "zod/v4";

/** Built-in node types known to the pipeline engine */
export const BuiltinNodeTypeSchema = z.enum([
  "compound",
  "condition",
  "code-file",
  "folder",
  "github-project",
  "operation",
  "output-project-path",
  "output-local-path",
]);
export type BuiltinNodeType = z.infer<typeof BuiltinNodeTypeSchema>;

/**
 * Node type — accepts built-in types plus any plugin-registered string.
 * Use `BuiltinNodeTypeSchema` when you need strict built-in validation.
 */
export const NodeTypeSchema = z.string();
export type NodeType = string;

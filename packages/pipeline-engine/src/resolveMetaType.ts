import type { MetaNodeType, BuiltinNodeType } from "@repo/schemas";

const BUILTIN_META_MAP: Record<BuiltinNodeType, MetaNodeType> = {
  "file": "object",
  folder: "object",
  "github-project": "object",
  prompt: "object",
  operation: "operation",
  compound: "operation",
  "output-local-path": "output",
  "output-project-path": "output",
};

/**
 * Resolve the metaType for a node.
 * - If `metaType` is explicitly set, use it.
 * - If `type` is a built-in type, look up from the map.
 * - Otherwise default to `"object"` (plugin-registered types are objects).
 */
export const resolveMetaType = (type: string, metaType?: MetaNodeType): MetaNodeType =>
  metaType ?? BUILTIN_META_MAP[type as BuiltinNodeType] ?? "object";

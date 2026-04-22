import type { MetaNodeType } from "./schemas/MetaNodeTypeSchema";
import type { BuiltinNodeType } from "./schemas/BuiltinNodeTypeSchema";

const BUILTIN_META_MAP: Record<BuiltinNodeType, MetaNodeType> = {
  "code-file": "object",
  folder: "object",
  "github-project": "object",
  operation: "operation",
  compound: "operation",
  condition: "operation",
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

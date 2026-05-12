import { type MetaNodeType, type BuiltinNodeType, META_NODE_TYPE_ENUM } from "@repo/schemas";

const BUILTIN_META_MAP: Record<BuiltinNodeType, MetaNodeType> = {
  file: "object",
  folder: "object",
  "github-project": "object",
  prompt: "object",
  operation: "operation",
  compound: "operation",
  "output-local-path": "output",
  "output-project-path": "output",
};

const VALID_META_TYPES: ReadonlySet<string> = new Set(Object.values(META_NODE_TYPE_ENUM));

/**
 * Resolve the metaType for a node.
 * - If `metaType` is explicitly set **and valid**, use it.
 * - If `type` is a built-in type, look up from the map.
 * - Otherwise default to `"object"` (plugin-registered types are objects).
 */
export const resolveMetaType = (type: string, metaType?: string): MetaNodeType => {
  const validMeta =
    metaType && VALID_META_TYPES.has(metaType) ? (metaType as MetaNodeType) : undefined;

  return validMeta ?? BUILTIN_META_MAP[type as BuiltinNodeType] ?? "object";
};

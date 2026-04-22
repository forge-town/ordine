import { z } from "zod/v4";
import { BuiltinNodeTypeSchema, type BuiltinNodeType } from "../BuiltinNodeTypeSchema";

const nodeTypeArray = z.array(BuiltinNodeTypeSchema);

export const NodeConnectionRulesSchema = z.object({
  "code-file": nodeTypeArray,
  compound: nodeTypeArray,
  condition: nodeTypeArray,
  folder: nodeTypeArray,
  "github-project": nodeTypeArray,
  operation: nodeTypeArray,
  "output-project-path": nodeTypeArray,
  "output-local-path": nodeTypeArray,
});
export type NodeConnectionRules = z.infer<typeof NodeConnectionRulesSchema>;

export const NODE_CONNECTION_RULES: NodeConnectionRules = NodeConnectionRulesSchema.parse({
  "code-file": ["operation", "compound"],
  compound: ["operation", "compound", "output-project-path", "output-local-path"],
  condition: [],
  folder: ["operation", "compound"],
  "github-project": ["operation", "compound"],
  operation: ["operation", "compound", "output-project-path", "output-local-path"],
  "output-project-path": [],
  "output-local-path": [],
} satisfies Record<BuiltinNodeType, BuiltinNodeType[]>);

export const isConnectionAllowed = (
  sourceType: BuiltinNodeType,
  targetType: BuiltinNodeType,
): boolean => NODE_CONNECTION_RULES[sourceType]?.includes(targetType) ?? false;

import { z } from "zod/v4";
import type { OperationRecord } from "@repo/db-schema";
import { LLM_PROVIDERS } from "@repo/db-schema";
import {
  NodeRunStatusSchema,
  DisclosureModeSchema,
  CodeFileNodeDataSchema,
  FolderNodeDataSchema,
  GitHubProjectNodeDataSchema,
  OperationNodeDataSchema as EngineOperationNodeDataSchema,
  OutputProjectPathNodeDataSchema,
  OutputLocalPathNodeDataSchema,
  CompoundNodeDataSchema,
  PipelineEdgeDataSchema,
  OUTPUT_MODES,
} from "@repo/pipeline-engine";

export { NodeRunStatusSchema, DisclosureModeSchema, OUTPUT_MODES };
export type { DisclosureMode } from "@repo/pipeline-engine";
export type NodeRunStatus = z.infer<typeof NodeRunStatusSchema>;

// ─── Node type sub-categories (Canvas-specific) ──────────────────────────────

export const ObjectNodeTypeSchema = z.enum(["code-file", "folder", "github-project"]);
export type ObjectNodeType = z.infer<typeof ObjectNodeTypeSchema>;

export const OperationNodeTypeSchema = z.literal("operation");
export type OperationNodeType = z.infer<typeof OperationNodeTypeSchema>;

export const OutputNodeTypeSchema = z.enum(["output-project-path", "output-local-path"]);
export type OutputNodeType = z.infer<typeof OutputNodeTypeSchema>;

export const CompoundNodeTypeSchema = z.literal("compound");
export type CompoundNodeType = z.infer<typeof CompoundNodeTypeSchema>;

export const NodeTypeSchema = z.union([
  ObjectNodeTypeSchema,
  OperationNodeTypeSchema,
  OutputNodeTypeSchema,
  CompoundNodeTypeSchema,
]);
export type NodeType = z.infer<typeof NodeTypeSchema>;

// ─── Re-export schemas from engine ────────────────────────────────────────────

export {
  CodeFileNodeDataSchema,
  FolderNodeDataSchema,
  GitHubProjectNodeDataSchema,
  OutputProjectPathNodeDataSchema,
  OutputLocalPathNodeDataSchema,
  CompoundNodeDataSchema,
  PipelineEdgeDataSchema,
};

// ─── Operation node data schema (Canvas-specific: narrows llmProvider to LLM_PROVIDERS enum) ───

export const OperationNodeDataSchema = EngineOperationNodeDataSchema.extend({
  llmProvider: z.enum(LLM_PROVIDERS).optional(),
});

// ─── Pipeline node data union (Canvas version, includes Canvas OperationNodeData) ─

export const PipelineNodeDataSchema = z.union([
  CodeFileNodeDataSchema,
  FolderNodeDataSchema,
  GitHubProjectNodeDataSchema,
  OperationNodeDataSchema,
  OutputProjectPathNodeDataSchema,
  OutputLocalPathNodeDataSchema,
  CompoundNodeDataSchema,
]);

// React Flow requires node data to extend Record<string, unknown>.
// Intersecting with it adds the index signature TypeScript needs.
export type CodeFileNodeData = z.infer<typeof CodeFileNodeDataSchema> & Record<string, unknown>;
export type FolderNodeData = z.infer<typeof FolderNodeDataSchema> & Record<string, unknown>;
export type GitHubProjectNodeData = z.infer<typeof GitHubProjectNodeDataSchema> &
  Record<string, unknown>;
export type OperationNodeData = z.infer<typeof OperationNodeDataSchema> & Record<string, unknown>;
export type OutputProjectPathNodeData = z.infer<typeof OutputProjectPathNodeDataSchema> &
  Record<string, unknown>;
export type OutputLocalPathNodeData = z.infer<typeof OutputLocalPathNodeDataSchema> &
  Record<string, unknown>;
export type CompoundNodeData = z.infer<typeof CompoundNodeDataSchema> & Record<string, unknown>;
export type PipelineNodeData = z.infer<typeof PipelineNodeDataSchema> & Record<string, unknown>;

export type PipelineEdgeData = z.infer<typeof PipelineEdgeDataSchema> & Record<string, unknown>;

// ─── Node categories ─────────────────────────────────────────────────────────

/** Object nodes — the subjects being operated on. */
export const OBJECT_TYPES: ObjectNodeType[] = ["code-file", "folder", "github-project"];

/** The single operation node type. */
export const OPERATION_TYPE: OperationNodeType = "operation";

/** Output node types — pipeline endpoints (no outgoing connections). */
export const OUTPUT_TYPES: OutputNodeType[] = ["output-project-path", "output-local-path"];

// ─── Connectivity rules (schema-first) ───────────────────────────────────────

/**
 * Zod schema for the connection-topology map.
 * Every NodeType key must be present; every value must be an array of
 * valid NodeType values.  Adding a new NodeType to NodeTypeSchema and
 * forgetting to add it here will be caught by TypeScript's satisfies check.
 */
export const NodeConnectionRulesSchema = z.object({
  "code-file": z.array(NodeTypeSchema),
  compound: z.array(NodeTypeSchema),
  folder: z.array(NodeTypeSchema),
  "github-project": z.array(NodeTypeSchema),
  operation: z.array(NodeTypeSchema),
  "output-project-path": z.array(NodeTypeSchema),
  "output-local-path": z.array(NodeTypeSchema),
});
export type NodeConnectionRules = z.infer<typeof NodeConnectionRulesSchema>;

/**
 * Single source of truth for the pipeline connection topology.
 * Edit ONLY this object to change which node types can connect to which.
 * Validated by NodeConnectionRulesSchema at module load.
 */
export const NODE_CONNECTION_RULES: NodeConnectionRules = NodeConnectionRulesSchema.parse({
  // Objects can only feed into operations or compound nodes
  "code-file": ["operation", "compound"],
  compound: ["operation", "compound", "output-project-path", "output-local-path"],
  folder: ["operation", "compound"],
  "github-project": ["operation", "compound"],
  // Operations can chain, feed into compound, or terminate at an output node
  operation: ["operation", "compound", "output-project-path", "output-local-path"],
  // Output nodes are pipeline endpoints — no outgoing edges
  "output-project-path": [],
  "output-local-path": [],
} satisfies Record<NodeType, NodeType[]>);

/**
 * Returns the connection-topology rules.
 * The optional `_operations` param is kept for API compatibility;
 * which *instances* to show in a menu is a UI concern separate from topology.
 */
export const getAllowedConnections = (_operations?: OperationRecord[]): NodeConnectionRules =>
  NODE_CONNECTION_RULES;

/** Returns true when sourceType → targetType is a permitted edge. */
export const isConnectionAllowed = (sourceType: NodeType, targetType: NodeType): boolean =>
  NODE_CONNECTION_RULES[sourceType]?.includes(targetType) ?? false;

/**
 * Runtime validator for a manual edge drag.
 * Returns a safe-parse error when the connection is not allowed.
 */
export const ConnectionRuleSchema = z
  .object({
    sourceType: NodeTypeSchema,
    targetType: NodeTypeSchema,
  })
  .refine(({ sourceType, targetType }) => NODE_CONNECTION_RULES[sourceType]?.includes(targetType), {
    message: "此节点类型间不允许连接",
  });

// ─── Default data factories ────────────────────────────────────────────────────

export const makeDefaultNodeData = (type: NodeType): PipelineNodeData => {
  switch (type) {
    case "operation": {
      return {
        label: "Operation",
        nodeType: "operation",
        operationId: "",
        operationName: "",
        status: "idle",
        config: {},
      };
    }
    case "code-file": {
      return {
        label: "代码文件",
        nodeType: "code-file",
        filePath: "",
        language: "typescript",
        description: "",
      };
    }
    case "folder": {
      return {
        label: "文件夹",
        nodeType: "folder",
        folderPath: "",
        description: "",
      };
    }
    case "github-project": {
      return {
        label: "GitHub 项目",
        nodeType: "github-project",
        owner: "",
        repo: "",
        branch: "main",
        description: "",
      };
    }
    case "output-project-path": {
      return {
        label: "项目路径输出",
        nodeType: "output-project-path",
        projectId: "",
        path: "",
        description: "",
      };
    }
    case "output-local-path": {
      return {
        label: "本地路径输出",
        nodeType: "output-local-path",
        localPath: "",
        description: "",
      };
    }
    case "compound": {
      return {
        label: "复合节点",
        nodeType: "compound",
        childNodeIds: [],
        description: "",
      };
    }
  }
};

/** Create operation node data from an OperationRecord. */
export const makeOperationNodeData = (operation: OperationRecord): OperationNodeData => ({
  label: operation.name,
  nodeType: "operation",
  operationId: operation.id,
  operationName: operation.name,
  status: "idle",
  config: {},
});

// ─── UI meta (label + Tailwind colour tokens) ─────────────────────────────────

export const nodeTypeMeta = {
  operation: {
    label: "Operation",
    shortLabel: "OP",
    border: "border-violet-200",
    selectedBorder: "border-violet-500",
    header: "bg-violet-50",
    headerText: "text-violet-700",
    iconBg: "bg-violet-500",
    handle: "!border-violet-400",
    plusBg: "bg-violet-100 text-violet-700 hover:bg-violet-200",
  },
  "code-file": {
    label: "代码文件",
    shortLabel: "文件",
    border: "border-orange-200",
    selectedBorder: "border-orange-500",
    header: "bg-orange-50",
    headerText: "text-orange-700",
    iconBg: "bg-orange-500",
    handle: "!border-orange-400",
    plusBg: "bg-orange-100 text-orange-700 hover:bg-orange-200",
  },
  folder: {
    label: "文件夹",
    shortLabel: "文件夹",
    border: "border-orange-200",
    selectedBorder: "border-orange-500",
    header: "bg-orange-50",
    headerText: "text-orange-700",
    iconBg: "bg-orange-400",
    handle: "!border-orange-400",
    plusBg: "bg-orange-100 text-orange-700 hover:bg-orange-200",
  },
  "github-project": {
    label: "GitHub 项目",
    shortLabel: "GitHub",
    border: "border-orange-200",
    selectedBorder: "border-orange-500",
    header: "bg-orange-50",
    headerText: "text-orange-700",
    iconBg: "bg-orange-600",
    handle: "!border-orange-400",
    plusBg: "bg-orange-100 text-orange-700 hover:bg-orange-200",
  },
  "output-project-path": {
    label: "项目路径输出",
    shortLabel: "输出",
    border: "border-teal-200",
    selectedBorder: "border-teal-500",
    header: "bg-teal-50",
    headerText: "text-teal-700",
    iconBg: "bg-teal-500",
    handle: "!border-teal-400",
    plusBg: "bg-teal-100 text-teal-700 hover:bg-teal-200",
  },
  "output-local-path": {
    label: "本地路径输出",
    shortLabel: "本地",
    border: "border-teal-200",
    selectedBorder: "border-teal-500",
    header: "bg-teal-50",
    headerText: "text-teal-700",
    iconBg: "bg-teal-600",
    handle: "!border-teal-400",
    plusBg: "bg-teal-100 text-teal-700 hover:bg-teal-200",
  },
  compound: {
    label: "复合节点",
    shortLabel: "组",
    border: "border-indigo-200",
    selectedBorder: "border-indigo-500",
    header: "bg-indigo-50",
    headerText: "text-indigo-700",
    iconBg: "bg-indigo-500",
    handle: "!border-indigo-400",
    plusBg: "bg-indigo-100 text-indigo-700 hover:bg-indigo-200",
  },
} as const satisfies Record<NodeType, object>;

/** Get meta for an operation node with dynamic label. */
export const getOperationNodeMeta = (operationName: string) => ({
  label: operationName,
  shortLabel: operationName.slice(0, 2).toUpperCase(),
  border: "border-violet-200",
  selectedBorder: "border-violet-500",
  header: "bg-violet-50",
  headerText: "text-violet-700",
  iconBg: "bg-violet-500",
  handle: "!border-violet-400",
  plusBg: "bg-violet-100 text-violet-700 hover:bg-violet-200",
});

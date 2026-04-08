import { z } from "zod/v4";
import type { OperationEntity } from "@/models/daos/operationsDao";

// ─── Primitive enums ──────────────────────────────────────────────────────────

export const NodeRunStatusSchema = z.enum(["idle", "running", "pass", "fail"]);
export type NodeRunStatus = z.infer<typeof NodeRunStatusSchema>;

// Static node types (objects)
export const ObjectNodeTypeSchema = z.enum(["code-file", "folder", "github-project"]);
export type ObjectNodeType = z.infer<typeof ObjectNodeTypeSchema>;

// Operation node type (dynamic)
export const OperationNodeTypeSchema = z.literal("operation");
export type OperationNodeType = z.infer<typeof OperationNodeTypeSchema>;

// Output node types (pipeline endpoints)
export const OutputNodeTypeSchema = z.enum(["output-project-path", "output-local-path"]);
export type OutputNodeType = z.infer<typeof OutputNodeTypeSchema>;

// All node types
export const NodeTypeSchema = z.union([
  ObjectNodeTypeSchema,
  OperationNodeTypeSchema,
  OutputNodeTypeSchema,
]);
export type NodeType = z.infer<typeof NodeTypeSchema>;

// ─── Node data schemas ────────────────────────────────────────────────────────

// ─── Object node data schemas ─────────────────────────────────────────────────

export const CodeFileNodeDataSchema = z.object({
  label: z.string(),
  nodeType: z.literal("code-file"),
  filePath: z.string(),
  language: z.string().optional(),
  description: z.string().optional(),
});

export const FolderNodeDataSchema = z.object({
  label: z.string(),
  nodeType: z.literal("folder"),
  folderPath: z.string(),
  description: z.string().optional(),
});

export const GitHubProjectNodeDataSchema = z.object({
  label: z.string(),
  nodeType: z.literal("github-project"),
  owner: z.string(),
  repo: z.string(),
  branch: z.string().optional(),
  description: z.string().optional(),
  isPrivate: z.boolean().optional(),
  githubProjectId: z.string().optional(),
});

// ─── Output node data schemas ────────────────────────────────────────────────

export const OutputProjectPathNodeDataSchema = z.object({
  label: z.string(),
  nodeType: z.literal("output-project-path"),
  projectId: z.string().optional(),
  path: z.string(),
  description: z.string().optional(),
});

export const OutputLocalPathNodeDataSchema = z.object({
  label: z.string(),
  nodeType: z.literal("output-local-path"),
  localPath: z.string(),
  description: z.string().optional(),
});

// ─── Operation node data schema ────────────────────────────────────────────────

export const OperationNodeDataSchema = z.object({
  label: z.string(),
  nodeType: z.literal("operation"),
  operationId: z.string(), // Reference to OperationEntity.id
  operationName: z.string(), // Display name
  status: NodeRunStatusSchema,
  config: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  notes: z.string().optional(),
});

// Note: Discriminated union requires at least 2 options with different literal values
// We use a union instead since we removed condition and have diverse types
export const PipelineNodeDataSchema = z.union([
  CodeFileNodeDataSchema,
  FolderNodeDataSchema,
  GitHubProjectNodeDataSchema,
  OperationNodeDataSchema,
  OutputProjectPathNodeDataSchema,
  OutputLocalPathNodeDataSchema,
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
export type PipelineNodeData = z.infer<typeof PipelineNodeDataSchema> & Record<string, unknown>;

// ─── Edge data schema ─────────────────────────────────────────────────────────

export const PipelineEdgeDataSchema = z.object({
  label: z.string().optional(),
  dataType: z.string().optional(),
});
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
  // Objects can only feed into operations
  "code-file": ["operation"],
  folder: ["operation"],
  "github-project": ["operation"],
  // Operations can chain or terminate at an output node
  operation: ["operation", "output-project-path", "output-local-path"],
  // Output nodes are pipeline endpoints — no outgoing edges
  "output-project-path": [],
  "output-local-path": [],
} satisfies Record<NodeType, NodeType[]>);

/**
 * Returns the connection-topology rules.
 * The optional `_operations` param is kept for API compatibility;
 * which *instances* to show in a menu is a UI concern separate from topology.
 */
export const getAllowedConnections = (_operations?: OperationEntity[]): NodeConnectionRules =>
  NODE_CONNECTION_RULES;

/** Alias for direct lookup without a function call. */
export const allowedConnections = NODE_CONNECTION_RULES;

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
  }
};

/** Create operation node data from an OperationEntity. */
export const makeOperationNodeData = (operation: OperationEntity): OperationNodeData => ({
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

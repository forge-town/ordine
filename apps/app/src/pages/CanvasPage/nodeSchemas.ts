import { z } from "zod";

// ─── Primitive enums ──────────────────────────────────────────────────────────

export const NodeRunStatusSchema = z.enum(["idle", "running", "pass", "fail"]);
export type NodeRunStatus = z.infer<typeof NodeRunStatusSchema>;

export const NodeTypeSchema = z.enum([
  "condition",
  "code-file",
  "folder",
  "github-project",
]);
export type NodeType = z.infer<typeof NodeTypeSchema>;

// ─── Node data schemas ────────────────────────────────────────────────────────

export const ConditionNodeDataSchema = z.object({
  label: z.string(),
  nodeType: z.literal("condition"),
  expression: z.string(),
  expectedResult: z.string(),
  status: NodeRunStatusSchema,
  notes: z.string().optional(),
});

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
});

export const PipelineNodeDataSchema = z.discriminatedUnion("nodeType", [
  ConditionNodeDataSchema,
  CodeFileNodeDataSchema,
  FolderNodeDataSchema,
  GitHubProjectNodeDataSchema,
]);

// React Flow requires node data to extend Record<string, unknown>.
// Intersecting with it adds the index signature TypeScript needs.
export type ConditionNodeData = z.infer<typeof ConditionNodeDataSchema> &
  Record<string, unknown>;
export type CodeFileNodeData = z.infer<typeof CodeFileNodeDataSchema> &
  Record<string, unknown>;
export type FolderNodeData = z.infer<typeof FolderNodeDataSchema> &
  Record<string, unknown>;
export type GitHubProjectNodeData = z.infer<
  typeof GitHubProjectNodeDataSchema
> &
  Record<string, unknown>;
export type PipelineNodeData = z.infer<typeof PipelineNodeDataSchema> &
  Record<string, unknown>;

// ─── Edge data schema ─────────────────────────────────────────────────────────

export const PipelineEdgeDataSchema = z.object({
  label: z.string().optional(),
  dataType: z.string().optional(),
});
export type PipelineEdgeData = z.infer<typeof PipelineEdgeDataSchema> &
  Record<string, unknown>;

// ─── Connectivity rules ───────────────────────────────────────────────────────

// ─── Node categories ─────────────────────────────────────────────────────────

/** Object nodes represent subjects/inputs being operated on. */
export const OBJECT_TYPES: NodeType[] = [
  "code-file",
  "folder",
  "github-project",
];

/** Operation nodes represent transformations/steps in the pipeline. */
export const OPERATION_TYPES: NodeType[] = ["condition"];

/** Which node types are allowed as targets from each source type. */
export const allowedConnections: Record<NodeType, NodeType[]> = {
  // Objects feed into condition
  "code-file": ["condition"],
  folder: ["condition"],
  "github-project": ["condition"],
  // Condition can chain or output back to an object
  condition: ["condition", "code-file", "folder", "github-project"],
};

/**
 * Runtime validator for a manual edge drag.
 * Returns a safe parse error when the connection is not allowed.
 */
export const ConnectionRuleSchema = z
  .object({
    sourceType: NodeTypeSchema,
    targetType: NodeTypeSchema,
  })
  .refine(
    ({ sourceType, targetType }) =>
      allowedConnections[sourceType].includes(targetType),
    { message: "此节点类型间不允许连接" },
  );

// ─── Default data factories ────────────────────────────────────────────────────

export const makeDefaultNodeData = (type: NodeType): PipelineNodeData => {
  switch (type) {
    case "condition": {
      return {
        label: "验收条件",
        nodeType: "condition",
        expression: "",
        expectedResult: "",
        status: "idle",
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
  }
};

// ─── UI meta (label + Tailwind colour tokens) ─────────────────────────────────

export const nodeTypeMeta = {
  condition: {
    label: "验收条件",
    shortLabel: "条件",
    border: "border-amber-200",
    selectedBorder: "border-amber-500",
    header: "bg-amber-50",
    headerText: "text-amber-700",
    iconBg: "bg-amber-500",
    handle: "!border-amber-400",
    plusBg: "bg-amber-100 text-amber-700 hover:bg-amber-200",
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
} as const satisfies Record<NodeType, object>;

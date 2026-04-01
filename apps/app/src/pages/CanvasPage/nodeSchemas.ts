import { z } from "zod";

// ─── Primitive enums ──────────────────────────────────────────────────────────

export const NodeRunStatusSchema = z.enum(["idle", "running", "pass", "fail"]);
export type NodeRunStatus = z.infer<typeof NodeRunStatusSchema>;

export const NodeTypeSchema = z.enum([
  "skill",
  "condition",
  "output",
  "code-file",
  "folder",
  "github-project",
]);
export type NodeType = z.infer<typeof NodeTypeSchema>;

// ─── Node data schemas ────────────────────────────────────────────────────────

export const SkillNodeDataSchema = z.object({
  label: z.string(),
  nodeType: z.literal("skill"),
  skillName: z.string(),
  params: z.string().optional(),
  acceptanceCriteria: z.string().optional(),
  status: NodeRunStatusSchema.optional(),
  notes: z.string().optional(),
});

export const ConditionNodeDataSchema = z.object({
  label: z.string(),
  nodeType: z.literal("condition"),
  expression: z.string(),
  expectedResult: z.string(),
  status: NodeRunStatusSchema,
  notes: z.string().optional(),
});

export const OutputNodeDataSchema = z.object({
  label: z.string(),
  nodeType: z.literal("output"),
  expectedSchema: z.string().optional(),
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
  SkillNodeDataSchema,
  ConditionNodeDataSchema,
  OutputNodeDataSchema,
  CodeFileNodeDataSchema,
  FolderNodeDataSchema,
  GitHubProjectNodeDataSchema,
]);

// React Flow requires node data to extend Record<string, unknown>.
// Intersecting with it adds the index signature TypeScript needs.
export type SkillNodeData = z.infer<typeof SkillNodeDataSchema> &
  Record<string, unknown>;
export type ConditionNodeData = z.infer<typeof ConditionNodeDataSchema> &
  Record<string, unknown>;
export type OutputNodeData = z.infer<typeof OutputNodeDataSchema> &
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
export const OPERATION_TYPES: NodeType[] = ["skill", "condition", "output"];

/** Which node types are allowed as targets from each source type. */
export const allowedConnections: Record<NodeType, NodeType[]> = {
  // Objects must feed into an Operation
  "code-file": ["skill", "condition", "output"],
  folder: ["skill", "condition", "output"],
  "github-project": ["skill", "condition", "output"],
  // Operations can chain into another Operation, or output to an Object (observation)
  skill: [
    "skill",
    "condition",
    "output",
    "code-file",
    "folder",
    "github-project",
  ],
  condition: [
    "skill",
    "condition",
    "output",
    "code-file",
    "folder",
    "github-project",
  ],
  output: ["code-file", "folder", "github-project"],
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
    case "skill": {
      return {
        label: "Skill 节点",
        nodeType: "skill",
        skillName: "",
        params: "{}",
        acceptanceCriteria: "",
        status: "idle",
      };
    }
    case "condition": {
      return {
        label: "验收条件",
        nodeType: "condition",
        expression: "",
        expectedResult: "",
        status: "idle",
      };
    }
    case "output": {
      return {
        label: "输出",
        nodeType: "output",
        expectedSchema: "",
        notes: "",
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
  skill: {
    label: "Skill 调用",
    shortLabel: "Skill",
    border: "border-violet-200",
    selectedBorder: "border-violet-500",
    header: "bg-violet-50",
    headerText: "text-violet-700",
    iconBg: "bg-violet-500",
    handle: "!border-violet-400",
    plusBg: "bg-violet-100 text-violet-700 hover:bg-violet-200",
  },
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
  output: {
    label: "输出节点",
    shortLabel: "输出",
    border: "border-sky-200",
    selectedBorder: "border-sky-500",
    header: "bg-sky-50",
    headerText: "text-sky-700",
    iconBg: "bg-sky-500",
    handle: "!border-sky-400",
    plusBg: "bg-sky-100 text-sky-700 hover:bg-sky-200",
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

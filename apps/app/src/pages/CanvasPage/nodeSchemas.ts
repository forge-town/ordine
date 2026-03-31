import { z } from "zod";

// ─── Primitive enums ──────────────────────────────────────────────────────────

export const NodeRunStatusSchema = z.enum(["idle", "running", "pass", "fail"]);
export type NodeRunStatus = z.infer<typeof NodeRunStatusSchema>;

export const NodeTypeSchema = z.enum(["input", "skill", "condition", "output"]);
export type NodeType = z.infer<typeof NodeTypeSchema>;

// ─── Node data schemas ────────────────────────────────────────────────────────

export const InputNodeDataSchema = z.object({
  label: z.string(),
  nodeType: z.literal("input"),
  contextDescription: z.string(),
  exampleValue: z.string().optional(),
});

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

export const PipelineNodeDataSchema = z.discriminatedUnion("nodeType", [
  InputNodeDataSchema,
  SkillNodeDataSchema,
  ConditionNodeDataSchema,
  OutputNodeDataSchema,
]);

// React Flow requires node data to extend Record<string, unknown>.
// Intersecting with it adds the index signature TypeScript needs.
export type InputNodeData = z.infer<typeof InputNodeDataSchema> &
  Record<string, unknown>;
export type SkillNodeData = z.infer<typeof SkillNodeDataSchema> &
  Record<string, unknown>;
export type ConditionNodeData = z.infer<typeof ConditionNodeDataSchema> &
  Record<string, unknown>;
export type OutputNodeData = z.infer<typeof OutputNodeDataSchema> &
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

/** Which node types are allowed as targets from each source type. */
export const allowedConnections: Record<NodeType, NodeType[]> = {
  input: ["skill", "condition"],
  skill: ["skill", "condition", "output"],
  condition: ["skill", "output"],
  output: [],
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
    case "input": {
      return {
        label: "输入",
        nodeType: "input",
        contextDescription: "",
        exampleValue: "",
      };
    }
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
  }
};

// ─── UI meta (label + Tailwind colour tokens) ─────────────────────────────────

export const nodeTypeMeta = {
  input: {
    label: "输入节点",
    shortLabel: "输入",
    border: "border-emerald-200",
    selectedBorder: "border-emerald-500",
    header: "bg-emerald-50",
    headerText: "text-emerald-700",
    iconBg: "bg-emerald-500",
    handle: "!border-emerald-400",
    plusBg: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200",
  },
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
} as const satisfies Record<NodeType, object>;

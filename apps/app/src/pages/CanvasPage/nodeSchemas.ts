import { z } from "zod/v4";
import { LLM_PROVIDERS, type OperationRecord } from "@repo/db-schema";
import {
  NodeRunStatusSchema,
  DisclosureModeSchema,
  ConditionNodeDataSchema,
  CodeFileNodeDataSchema,
  FolderNodeDataSchema,
  GitHubProjectNodeDataSchema,
  OperationNodeDataSchema as EngineOperationNodeDataSchema,
  OutputProjectPathNodeDataSchema,
  OutputLocalPathNodeDataSchema,
  CompoundNodeDataSchema,
  PipelineEdgeDataSchema,
  OUTPUT_MODES,
  ObjectNodeTypeSchema,
  OperationNodeTypeSchema,
  OutputNodeTypeSchema,
  CompoundNodeTypeSchema,
  NodeConnectionRulesSchema,
  NODE_CONNECTION_RULES,
  isConnectionAllowed,
  ConnectionRuleSchema,
  OBJECT_TYPES,
  OPERATION_TYPE,
  OUTPUT_TYPES,
  type NodeType,
  type DisclosureMode,
} from "@repo/pipeline-engine/schemas";

export { NodeRunStatusSchema, DisclosureModeSchema, OUTPUT_MODES };
export type { DisclosureMode };
export type NodeRunStatus = z.infer<typeof NodeRunStatusSchema>;

// ─── Node type sub-categories (re-exported from engine) ──────────────────────

export {
  ObjectNodeTypeSchema,
  OperationNodeTypeSchema,
  OutputNodeTypeSchema,
  CompoundNodeTypeSchema,
};
export type {
  ObjectNodeType,
  OperationNodeType,
  OutputNodeType,
  CompoundNodeType,
} from "@repo/pipeline-engine/schemas";

export { NodeTypeSchema } from "@repo/pipeline-engine/schemas";
export type { NodeType } from "@repo/pipeline-engine/schemas";

// ─── Re-export schemas from engine ────────────────────────────────────────────

export {
  ConditionNodeDataSchema,
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
  ConditionNodeDataSchema,
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
export type ConditionNodeData = z.infer<typeof ConditionNodeDataSchema> & Record<string, unknown>;
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

// ─── Node categories (re-exported from engine) ──────────────────────────────

export { OBJECT_TYPES, OPERATION_TYPE, OUTPUT_TYPES };

// ─── Connectivity rules (re-exported from engine) ────────────────────────────

export {
  NodeConnectionRulesSchema,
  NODE_CONNECTION_RULES,
  isConnectionAllowed,
  ConnectionRuleSchema,
};
export type { NodeConnectionRules } from "@repo/pipeline-engine/schemas";

export const getAllowedConnections = (
  _operations?: OperationRecord[],
): z.infer<typeof NodeConnectionRulesSchema> => NODE_CONNECTION_RULES;

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
    case "condition": {
      return {
        label: "条件节点",
        nodeType: "condition",
        expression: "",
        expectedResult: "",
        status: "idle",
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
  condition: {
    label: "条件节点",
    shortLabel: "条件",
    border: "border-amber-200",
    selectedBorder: "border-amber-500",
    header: "bg-amber-50",
    headerText: "text-amber-700",
    iconBg: "bg-amber-500",
    handle: "!border-amber-400",
    plusBg: "bg-amber-100 text-amber-700 hover:bg-amber-200",
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

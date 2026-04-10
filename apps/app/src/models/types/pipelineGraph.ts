import type { LlmProvider } from "@/models/tables/settings_table";

// Pipeline graph node/edge types for DB and business logic (decoupled from page store)

export type NodeType =
  | "condition"
  | "code-file"
  | "folder"
  | "github-project"
  | "operation"
  | "output-project-path"
  | "output-local-path";

export type NodeRunStatus = "idle" | "running" | "pass" | "fail";

export interface ConditionNodeData {
  label: string;
  nodeType: "condition";
  expression: string;
  expectedResult: string;
  status: NodeRunStatus;
  notes?: string;
}

export interface CodeFileNodeData {
  label: string;
  nodeType: "code-file";
  filePath: string;
  language?: string;
  description?: string;
}

export interface FolderNodeData {
  label: string;
  nodeType: "folder";
  folderPath: string;
  description?: string;
}

export interface GitHubProjectNodeData {
  label: string;
  nodeType: "github-project";
  owner: string;
  repo: string;
  branch?: string;
  description?: string;
  isPrivate?: boolean;
  githubProjectId?: string;
}

export interface OperationNodeData {
  label: string;
  nodeType: "operation";
  operationId: string;
  operationName: string;
  status: NodeRunStatus;
  config?: Record<string, string | number | boolean>;
  notes?: string;
  llmProvider?: LlmProvider;
  llmModel?: string;
  bestPracticeId?: string;
  bestPracticeName?: string;
}

export interface OutputProjectPathNodeData {
  label: string;
  nodeType: "output-project-path";
  projectId?: string;
  path: string;
  description?: string;
}

export const OUTPUT_MODES = ["overwrite", "error_if_exists", "auto_rename"] as const;
export type OutputMode = (typeof OUTPUT_MODES)[number];

export interface OutputLocalPathNodeData {
  label: string;
  nodeType: "output-local-path";
  localPath: string;
  outputFileName?: string;
  outputMode?: OutputMode;
  description?: string;
}

export type PipelineNodeData =
  | ConditionNodeData
  | CodeFileNodeData
  | FolderNodeData
  | GitHubProjectNodeData
  | OperationNodeData
  | OutputProjectPathNodeData
  | OutputLocalPathNodeData;

export interface PipelineEdgeData {
  label?: string;
  dataType?: string;
}

export interface PipelineNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: PipelineNodeData;
}

export interface PipelineEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  data?: PipelineEdgeData;
}

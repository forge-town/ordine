// Pipeline graph node/edge types for DB and business logic (decoupled from page store)

export type NodeRunStatus = "idle" | "running" | "pass" | "fail";
export type NodeType = "input" | "skill" | "condition" | "output";

export interface InputNodeData {
  label: string;
  nodeType: "input";
  contextDescription: string;
  exampleValue?: string;
}

export interface SkillNodeData {
  label: string;
  nodeType: "skill";
  skillName: string;
  params: string;
  acceptanceCriteria: string;
  status: NodeRunStatus;
  notes?: string;
}

export interface ConditionNodeData {
  label: string;
  nodeType: "condition";
  expression: string;
  expectedResult: string;
  status: NodeRunStatus;
  notes?: string;
}

export interface OutputNodeData {
  label: string;
  nodeType: "output";
  expectedSchema?: string;
  notes?: string;
}

export type PipelineNodeData =
  | InputNodeData
  | SkillNodeData
  | ConditionNodeData
  | OutputNodeData;

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

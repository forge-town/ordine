import type { PipelineEngineDeps } from "../deps.js";
import type { NodeCtx, PipelineNode } from "../schemas/index.js";
import type { PipelineRunError } from "../errors.js";

export type NodeResult = { ok: true } | { ok: false; error: PipelineRunError | null };

export type OperationExecResult =
  | { ok: true; content: string }
  | { ok: false; error: PipelineRunError | null };

export interface NodeContext {
  node: PipelineNode;
  input: NodeCtx;
  deps: PipelineEngineDeps;
  nodeOutputs: Map<string, NodeCtx>;
  tempDirs: string[];
}

export interface OperationNodeContext extends NodeContext {
  operations: Map<string, OperationInfo>;
  lookupSkill: (id: string) => Promise<SkillInfo | null>;
  lookupBestPractice: (id: string) => Promise<{ title: string; content: string } | null>;
  jobId: string;
  githubToken?: string;
}

export interface OperationInfo {
  id: string;
  name: string;
  config: string;
}

export interface SkillInfo {
  id: string;
  label: string;
  description: string;
}

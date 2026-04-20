import type { PipelineEngineDeps } from "../deps";
import type { NodeCtx, PipelineNode } from "../schemas";
import type { PipelineRunError } from "../errors";

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
  jobId: string;
  onTmuxSession?: (sessionName: string) => Promise<void>;
}

export interface OperationNodeContext extends NodeContext {
  operations: Map<string, OperationInfo>;
  lookupSkill: (id: string) => Promise<SkillInfo | null>;
  lookupBestPractice: (id: string) => Promise<{ title: string; content: string } | null>;
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

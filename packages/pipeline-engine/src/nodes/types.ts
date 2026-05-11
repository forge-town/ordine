import type { PipelineEngineDeps } from "../deps";
import type { OperationConfigInput, PipelineNode } from "@repo/schemas";
import type { NodeCtx } from "../schemas";
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
  defaultOutputPath?: string;
}

export interface OperationNodeContext extends NodeContext {
  operations: Map<string, OperationInfo>;
  lookupAgent: (id: string) => Promise<AgentInfo | null>;
  lookupSkill: (id: string) => Promise<SkillInfo | null>;
  lookupBestPractice: (id: string) => Promise<{ title: string; content: string } | null>;
  githubToken?: string;
}

export interface AgentInfo {
  id: string;
  name: string;
  defaultRuntime: string | null;
}

export interface OperationInfo {
  id: string;
  name: string;
  config: OperationConfigInput;
}

export interface SkillInfo {
  id: string;
  label: string;
  description: string;
}

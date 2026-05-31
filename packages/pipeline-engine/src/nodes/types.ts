import type { PipelineRunError } from "../errors";
export type {
  AgentInfo,
  NodeContext,
  OperationInfo,
  OperationNodeContext,
  SkillInfo,
} from "../schemas";

export type NodeResult = { ok: true } | { ok: false; error: PipelineRunError | null };

export type OperationExecResult =
  | { ok: true; content: string }
  | { ok: false; error: PipelineRunError | null };

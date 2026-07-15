import type { PipelineRunError } from "../errors";
export type {
  AgentInfo,
  NodeContext,
  OperationInfo,
  OperationNodeContext,
  SkillInfo,
} from "../schemas";

/**
 * Outcome of running one node:
 * - "completed": the node produced its output; the run continues.
 * - "soft-failed": the node is marked failed (e.g. misconfigured) but the run continues.
 *   No output is recorded, so edges out of the node stay inactive and downstream nodes skip.
 * - "failed": hard failure; the run aborts with the error.
 */
export type NodeResult =
  | { outcome: "completed" }
  | { outcome: "soft-failed" }
  | { outcome: "failed"; error: PipelineRunError };

export type OperationExecResult =
  | { outcome: "completed"; content: string }
  | { outcome: "soft-failed" }
  | { outcome: "failed"; error: PipelineRunError };

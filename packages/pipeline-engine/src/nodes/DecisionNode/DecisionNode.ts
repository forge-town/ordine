import { trace } from "@repo/obs";
import {
  encodeDecisionResolved,
  encodeDecisionWait,
  type DecisionSelectMode,
  type NodeRunStatus,
  type PipelineEdge,
  type PipelineNode,
} from "@repo/schemas";
import type { NodeCtx } from "../../schemas";
import { ScriptExecutionError } from "../../errors";
import type { NodeResult } from "../types";

/** 单个候选 = 一条入边的源节点产物。 */
export interface DecisionCandidate {
  nodeId: string;
  label?: string;
  content: string;
  inputPath?: string;
}

export interface PipelineDecisionEvent {
  jobId: string;
  nodeId: string;
  selectMode: DecisionSelectMode;
  candidates: DecisionCandidate[];
}

export interface DecisionResult {
  selectedNodeIds: string[];
}

export interface ProcessDecisionNodeArgs {
  node: PipelineNode;
  jobId: string;
  edges: PipelineEdge[];
  nodeOutputs: Map<string, NodeCtx>;
  isEdgeActive: (edge: PipelineEdge) => Promise<boolean>;
  applyEdgeTransform: (edge: PipelineEdge, input: NodeCtx) => NodeCtx;
  nodeLabel: (nodeId: string) => string | undefined;
  selectMode: DecisionSelectMode;
  waitForDecision?: (event: PipelineDecisionEvent) => Promise<DecisionResult>;
  emitStatus: (status: NodeRunStatus) => Promise<void>;
}

const JOIN = "\n\n---\n\n";

const collectCandidates = async (args: ProcessDecisionNodeArgs): Promise<DecisionCandidate[]> => {
  const incoming = args.edges.filter((edge) => edge.target === args.node.id);
  const candidates: DecisionCandidate[] = [];
  for (const edge of incoming) {
    if (!(await args.isEdgeActive(edge))) continue;
    const src = args.nodeOutputs.get(edge.source);
    if (!src) continue;
    const ctx = args.applyEdgeTransform(edge, src);
    candidates.push({
      nodeId: edge.source,
      label: args.nodeLabel(edge.source),
      content: ctx.content,
      inputPath: ctx.inputPath,
    });
  }

  return candidates;
};

/**
 * 人类决策节点：收集入边候选 → 挂起等待用户选择 → 用选中候选构造本节点产物。
 *
 * 特别警告（来自施工手册）：**禁止伪造人类决策**——无决策处理器（waitForDecision）时直接失败，
 * 绝不自动选第一个；用户未选任何候选（空选）同样失败，不静默兜底。
 */
export const processDecisionNode = async (args: ProcessDecisionNodeArgs): Promise<NodeResult> => {
  const candidates = await collectCandidates(args);

  if (!args.waitForDecision) {
    return {
      ok: false,
      error: new ScriptExecutionError(
        `Decision node ${args.node.id} requires a human decision handler`,
      ),
    };
  }

  await args.emitStatus("waitingForUser");
  await trace(args.jobId, encodeDecisionWait(args.node.id, candidates.length));

  const { selectedNodeIds } = await args.waitForDecision({
    jobId: args.jobId,
    nodeId: args.node.id,
    selectMode: args.selectMode,
    candidates,
  });

  const selected = candidates.filter((candidate) => selectedNodeIds.includes(candidate.nodeId));
  if (selected.length === 0) {
    return {
      ok: false,
      error: new ScriptExecutionError(`Decision node ${args.node.id} resolved with no selection`),
    };
  }

  args.nodeOutputs.set(args.node.id, {
    inputPath: selected.find((candidate) => candidate.inputPath)?.inputPath ?? "",
    content: selected
      .map((candidate) => candidate.content)
      .filter(Boolean)
      .join(JOIN),
  });
  await trace(
    args.jobId,
    encodeDecisionResolved(
      args.node.id,
      selected.map((candidate) => candidate.nodeId),
    ),
  );

  return { ok: true };
};

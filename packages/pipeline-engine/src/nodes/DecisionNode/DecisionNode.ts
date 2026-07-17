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

/** One candidate = the output of one incoming edge's source node. */
export interface DecisionCandidate {
  /** Unique per incoming edge (the edge id), so parallel edges from the same source stay distinct. */
  candidateId: string;
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
  selectedCandidateIds: string[];
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
      candidateId: edge.id,
      nodeId: edge.source,
      label: args.nodeLabel(edge.source),
      content: ctx.content,
      inputPath: ctx.inputPath,
    });
  }

  return candidates;
};

/**
 * Human decision node: collect candidates from incoming edges, suspend until the user
 * picks one, then build this node's output from the chosen candidate.
 *
 * Human decisions must never be fabricated: without a decision handler (waitForDecision)
 * the node fails outright — it never auto-picks the first candidate — and an empty
 * selection fails the same way instead of silently falling back.
 */
export const processDecisionNode = async (args: ProcessDecisionNodeArgs): Promise<NodeResult> => {
  const candidates = await collectCandidates(args);

  if (!args.waitForDecision) {
    return {
      outcome: "failed",
      error: new ScriptExecutionError(
        `Decision node ${args.node.id} requires a human decision handler`,
      ),
    };
  }

  await args.emitStatus("waitingForUser");
  await trace(args.jobId, encodeDecisionWait(args.node.id, candidates.length));

  // A rejecting handler must not escape the NodeResult contract — it would crash the
  // whole run past node finalization and temp-dir cleanup.
  const decision = await args
    .waitForDecision({
      jobId: args.jobId,
      nodeId: args.node.id,
      selectMode: args.selectMode,
      candidates,
    })
    .then(
      (value) => ({ ok: true as const, value }),
      (cause: unknown) => ({
        ok: false as const,
        message: cause instanceof Error ? cause.message : String(cause),
      }),
    );
  if (!decision.ok) {
    return {
      outcome: "failed",
      error: new ScriptExecutionError(
        `Decision handler for node ${args.node.id} failed: ${decision.message}`,
      ),
    };
  }

  const { selectedCandidateIds } = decision.value;
  const candidatesById = new Map(candidates.map((candidate) => [candidate.candidateId, candidate]));

  const unknownIds = selectedCandidateIds.filter((id) => !candidatesById.has(id));
  if (unknownIds.length > 0) {
    return {
      outcome: "failed",
      error: new ScriptExecutionError(
        `Decision node ${args.node.id} resolved with unknown candidate id(s): ${unknownIds.join(", ")}`,
      ),
    };
  }
  if (new Set(selectedCandidateIds).size !== selectedCandidateIds.length) {
    return {
      outcome: "failed",
      error: new ScriptExecutionError(
        `Decision node ${args.node.id} resolved with duplicate candidate ids`,
      ),
    };
  }
  if (selectedCandidateIds.length === 0) {
    return {
      outcome: "failed",
      error: new ScriptExecutionError(`Decision node ${args.node.id} resolved with no selection`),
    };
  }
  if (args.selectMode === "single" && selectedCandidateIds.length !== 1) {
    return {
      outcome: "failed",
      error: new ScriptExecutionError(
        `Decision node ${args.node.id} is single-select but resolved with ${selectedCandidateIds.length} selections`,
      ),
    };
  }

  const selected = selectedCandidateIds.map((id) => candidatesById.get(id)!);

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
      selected.map((candidate) => candidate.candidateId),
    ),
  );

  return { outcome: "completed" };
};

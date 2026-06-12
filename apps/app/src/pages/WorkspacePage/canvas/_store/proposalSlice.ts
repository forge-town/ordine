import type { StateCreator } from "zustand";
import { applyPipelineActions } from "@repo/pipeline-engine/actions";
import type { PipelineActionDiagnostic, PipelineActionProposal } from "@repo/schemas";
import type { PanelSlice } from "./panelSlice";
import type { SelectionSlice } from "./selectionSlice";
import {
  fromPipelineSnapshot,
  toPipelineSnapshot,
  type CanvasEdge,
  type CanvasNode,
} from "./canvasTypes";

type ProposalGraphState = {
  edges: CanvasEdge[];
  nodes: CanvasNode[];
};

export type ProposalPreviewDiff = "new" | "modified" | "reuse";

export type ProposalPreview = {
  diffById: Record<string, ProposalPreviewDiff>;
  edges: CanvasEdge[];
  newEdgeIds: string[];
  nodes: CanvasNode[];
};

export type ProposalSlice = {
  pendingProposal: PipelineActionProposal | null;
  proposalDiagnostics: PipelineActionDiagnostic[] | null;
  proposalPreview: ProposalPreview | null;
  applyPendingProposal: () => boolean;
  applyProposal: (proposal: PipelineActionProposal) => boolean;
  clearPendingProposal: () => void;
  rejectProposal: () => void;
  setPendingProposal: (
    proposal: PipelineActionProposal | null,
    diagnostics?: PipelineActionDiagnostic[] | null,
  ) => void;
};

/**
 * Dry-runs the proposal against the current graph so the canvas can render a
 * ghost preview (prototype canvas.jsx preview phase: new / edited / reused
 * badges) before the user approves. Returns null when actions cannot apply.
 */
const computeProposalPreview = (
  nodes: CanvasNode[],
  edges: CanvasEdge[],
  proposal: PipelineActionProposal,
): ProposalPreview | null => {
  const result = applyPipelineActions(toPipelineSnapshot({ edges, nodes }), proposal.actions);

  if (result.isErr()) {
    return null;
  }

  const next = fromPipelineSnapshot(result.value);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const edgeIds = new Set(edges.map((edge) => edge.id));
  const diffById: Record<string, ProposalPreviewDiff> = {};

  for (const node of next.nodes) {
    const current = nodeById.get(node.id);
    diffById[node.id] = current
      ? JSON.stringify(current.data) === JSON.stringify(node.data)
        ? "reuse"
        : "modified"
      : "new";
  }

  return {
    diffById,
    edges: next.edges,
    newEdgeIds: next.edges.filter((edge) => !edgeIds.has(edge.id)).map((edge) => edge.id),
    nodes: next.nodes,
  };
};

type ProposalStoreState = PanelSlice & ProposalGraphState & ProposalSlice & SelectionSlice;

const clearProposalInteractionState = {
  configNodeId: null,
  inspectEdgeId: null,
  pendingProposal: null,
  proposalDiagnostics: null,
  proposalPreview: null,
  selectedEdgeId: null,
  selectedIds: [],
  selectedNodeId: null,
} satisfies Partial<ProposalStoreState>;

export const createProposalSlice =
  <T extends ProposalStoreState>(): StateCreator<T, [], [], ProposalSlice> =>
  (set, get) => ({
    pendingProposal: null,
    proposalDiagnostics: null,
    proposalPreview: null,
    applyPendingProposal: () => {
      const proposal = get().pendingProposal;

      return proposal ? get().applyProposal(proposal) : false;
    },
    applyProposal: (proposal) => {
      const result = applyPipelineActions(
        toPipelineSnapshot({
          edges: get().edges,
          nodes: get().nodes,
        }),
        proposal.actions,
      );

      if (result.isErr()) {
        set({
          proposalDiagnostics: result.error,
        } as unknown as Partial<T>);

        return false;
      }

      const next = fromPipelineSnapshot(result.value);
      set({
        ...clearProposalInteractionState,
        edges: next.edges,
        nodes: next.nodes,
      } as unknown as Partial<T>);

      return true;
    },
    clearPendingProposal: () =>
      set({
        pendingProposal: null,
        proposalDiagnostics: null,
        proposalPreview: null,
      } as unknown as Partial<T>),
    rejectProposal: () => get().clearPendingProposal(),
    setPendingProposal: (proposal, diagnostics = null) =>
      set({
        pendingProposal: proposal,
        proposalDiagnostics: diagnostics,
        proposalPreview: proposal
          ? computeProposalPreview(get().nodes, get().edges, proposal)
          : null,
      } as unknown as Partial<T>),
  });

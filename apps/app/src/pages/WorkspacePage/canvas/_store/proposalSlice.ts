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

export type ProposalSlice = {
  pendingProposal: PipelineActionProposal | null;
  proposalDiagnostics: PipelineActionDiagnostic[] | null;
  applyPendingProposal: () => boolean;
  applyProposal: (proposal: PipelineActionProposal) => boolean;
  clearPendingProposal: () => void;
  rejectProposal: () => void;
  setPendingProposal: (
    proposal: PipelineActionProposal | null,
    diagnostics?: PipelineActionDiagnostic[] | null,
  ) => void;
};

type ProposalStoreState = PanelSlice & ProposalGraphState & ProposalSlice & SelectionSlice;

const clearProposalInteractionState = {
  configNodeId: null,
  inspectEdgeId: null,
  pendingProposal: null,
  proposalDiagnostics: null,
  selectedEdgeId: null,
  selectedIds: [],
  selectedNodeId: null,
} satisfies Partial<ProposalStoreState>;

export const createProposalSlice =
  <T extends ProposalStoreState>(): StateCreator<T, [], [], ProposalSlice> =>
  (set, get) => ({
    pendingProposal: null,
    proposalDiagnostics: null,
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
      } as unknown as Partial<T>),
    rejectProposal: () => get().clearPendingProposal(),
    setPendingProposal: (proposal, diagnostics = null) =>
      set({
        pendingProposal: proposal,
        proposalDiagnostics: diagnostics,
      } as unknown as Partial<T>),
  });

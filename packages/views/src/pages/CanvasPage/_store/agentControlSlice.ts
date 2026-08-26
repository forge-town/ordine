import { applyPipelineActions } from "@repo/pipeline-engine/actions";
import type { AgentChangeSet, PipelineAction, PipelineGraphSnapshot } from "@repo/schemas";
import type { CanvasPageStoreSlice } from "./canvasPageStore";
import { sortParentBeforeChildren, type PipelineEdge, type PipelineNode } from "./canvasSlice";

export type AgentCanvasEffect = "enter" | "update" | "exit";

export interface AgentControlSlice {
  pipelineVersion: number;
  activeAgentChangeSetId: string | null;
  agentBaseSnapshot: PipelineGraphSnapshot | null;
  agentAppliedActionIds: string[];
  agentNodeEffects: Record<string, AgentCanvasEffect>;
  agentEdgeEffects: Record<string, AgentCanvasEffect>;
  isAgentStructureLocked: boolean;
  hydrateAgentChangeSet: (changeSet: AgentChangeSet, appliedActionIds?: string[]) => void;
  applyAgentDraftAction: (input: {
    actionId: string;
    changeSetId: string;
    action: PipelineAction;
  }) => Promise<void>;
  rollbackAgentChangeSet: (changeSetId: string) => void;
  commitAgentChangeSet: (input: {
    changeSetId: string;
    previousVersion: number;
    newVersion: number;
  }) => void;
}

const toCanvasSnapshot = (snapshot: PipelineGraphSnapshot) => {
  const nodes = [...snapshot.nodes] as PipelineNode[];
  sortParentBeforeChildren(nodes);

  return { nodes, edges: snapshot.edges as PipelineEdge[] };
};

const motionDelay = (milliseconds: number) =>
  globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 0 : milliseconds;

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => globalThis.setTimeout(resolve, milliseconds));

export const createAgentControlSlice = (
  set: Parameters<CanvasPageStoreSlice>[0],
  get: Parameters<CanvasPageStoreSlice>[1],
  initialVersion = 1,
): AgentControlSlice => {
  const clearNodeEffect = (nodeId: string, effect: AgentCanvasEffect, delay: number) => {
    globalThis.setTimeout(() => {
      set((state) => {
        if (state.agentNodeEffects[nodeId] !== effect) return {};
        const next = { ...state.agentNodeEffects };
        delete next[nodeId];

        return { agentNodeEffects: next };
      });
    }, motionDelay(delay));
  };
  const clearEdgeEffect = (edgeId: string, effect: AgentCanvasEffect, delay: number) => {
    globalThis.setTimeout(() => {
      set((state) => {
        if (state.agentEdgeEffects[edgeId] !== effect) return {};
        const next = { ...state.agentEdgeEffects };
        delete next[edgeId];

        return { agentEdgeEffects: next };
      });
    }, motionDelay(delay));
  };

  return {
    pipelineVersion: initialVersion,
    activeAgentChangeSetId: null,
    agentBaseSnapshot: null,
    agentAppliedActionIds: [],
    agentNodeEffects: {},
    agentEdgeEffects: {},
    isAgentStructureLocked: false,

    hydrateAgentChangeSet(changeSet, appliedActionIds = []) {
      if (!changeSet.draftSnapshot || !changeSet.baseSnapshot) return;
      const snapshot = toCanvasSnapshot(changeSet.draftSnapshot);
      set({
        ...snapshot,
        activeAgentChangeSetId: changeSet.id,
        agentBaseSnapshot: changeSet.baseSnapshot,
        agentAppliedActionIds: appliedActionIds,
        agentNodeEffects: {},
        agentEdgeEffects: {},
        isAgentStructureLocked: true,
        pipelineVersion: changeSet.baseVersion,
      });
    },

    async applyAgentDraftAction({ actionId, changeSetId, action }) {
      const state = get();
      if (state.agentAppliedActionIds.includes(actionId)) return;
      const baseSnapshot = state.agentBaseSnapshot ?? { nodes: state.nodes, edges: state.edges };
      if (state.activeAgentChangeSetId && state.activeAgentChangeSetId !== changeSetId) return;

      const exitNodeId = action.type === "removeNode" ? action.nodeId : null;
      const exitEdgeId = action.type === "removeEdge" ? action.edgeId : null;
      if (exitNodeId) {
        set((current) => ({
          agentNodeEffects: { ...current.agentNodeEffects, [exitNodeId]: "exit" },
        }));
      }
      if (exitEdgeId) {
        set((current) => ({
          agentEdgeEffects: { ...current.agentEdgeEffects, [exitEdgeId]: "exit" },
        }));
      }
      if (exitNodeId || exitEdgeId) await wait(motionDelay(140));

      const latest = get();
      const applied = applyPipelineActions({ nodes: latest.nodes, edges: latest.edges }, [action]);
      if (applied.isErr()) return;
      const snapshot = toCanvasSnapshot(applied.value);
      const nodeEffectId =
        action.type === "addNode"
          ? action.node.id
          : action.type === "replaceNodeData"
            ? action.nodeId
            : null;
      const edgeEffectId = action.type === "addEdge" ? action.edge.id : null;
      const nodeEffect = action.type === "addNode" ? "enter" : "update";
      set((current) => ({
        ...snapshot,
        activeAgentChangeSetId: changeSetId,
        agentBaseSnapshot: current.agentBaseSnapshot ?? baseSnapshot,
        agentAppliedActionIds: [...current.agentAppliedActionIds, actionId],
        agentNodeEffects: nodeEffectId
          ? { ...current.agentNodeEffects, [nodeEffectId]: nodeEffect }
          : current.agentNodeEffects,
        agentEdgeEffects: edgeEffectId
          ? { ...current.agentEdgeEffects, [edgeEffectId]: "enter" }
          : current.agentEdgeEffects,
        isAgentStructureLocked: true,
      }));
      if (nodeEffectId)
        clearNodeEffect(nodeEffectId, nodeEffect, nodeEffect === "enter" ? 240 : 520);
      if (edgeEffectId) clearEdgeEffect(edgeEffectId, "enter", 300);
    },

    rollbackAgentChangeSet(changeSetId) {
      const state = get();
      if (state.activeAgentChangeSetId !== changeSetId || !state.agentBaseSnapshot) return;
      set({
        ...toCanvasSnapshot(state.agentBaseSnapshot),
        activeAgentChangeSetId: null,
        agentBaseSnapshot: null,
        agentAppliedActionIds: [],
        agentNodeEffects: {},
        agentEdgeEffects: {},
        isAgentStructureLocked: false,
      });
    },

    commitAgentChangeSet({ changeSetId, previousVersion, newVersion }) {
      const state = get();
      if (state.activeAgentChangeSetId !== changeSetId || !state.agentBaseSnapshot) return;
      state.recordAgentChangeSet(
        changeSetId,
        previousVersion,
        newVersion,
        state.agentBaseSnapshot,
        { nodes: state.nodes, edges: state.edges },
      );
      set({
        pipelineVersion: newVersion,
        activeAgentChangeSetId: null,
        agentBaseSnapshot: null,
        agentAppliedActionIds: [],
        agentNodeEffects: {},
        agentEdgeEffects: {},
        isAgentStructureLocked: false,
      });
    },
  };
};

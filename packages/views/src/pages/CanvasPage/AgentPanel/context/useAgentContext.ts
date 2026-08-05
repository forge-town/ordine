import { useMemo } from "react";
import { useStore } from "zustand";
import type { WorkspaceCanvasRef } from "@repo/schemas";
import { useCanvasPageStore } from "../../_store";
import { countAnchorsByRef, useAgentBarStore } from "../_store";
import { buildAgentContext } from "./buildAgentContext";

export const useAgentContext = () => {
  const canvasStore = useCanvasPageStore();
  const activeJobId = useStore(canvasStore, (state) => state.activeJobId);
  const edges = useStore(canvasStore, (state) => state.edges);
  const isRunning = useStore(canvasStore, (state) => state.isRunning);
  const messages = useAgentBarStore((state) => state.messages);
  const nodeRunStatuses = useStore(canvasStore, (state) => state.nodeRunStatuses);
  const nodes = useStore(canvasStore, (state) => state.nodes);
  const pipelineId = useStore(canvasStore, (state) => state.pipelineId);
  const pipelineName = useStore(canvasStore, (state) => state.pipelineName);
  const selectedEdgeId = useStore(canvasStore, (state) => state.selectedEdgeId);
  const selectedNodeId = useStore(canvasStore, (state) => state.selectedNodeId);

  return useMemo(() => {
    const canvasRefs: WorkspaceCanvasRef[] = [];
    const selectedNode = nodes.find((node) => node.id === selectedNodeId);
    if (selectedNode) {
      canvasRefs.push({
        baseId: selectedNode.id,
        id: selectedNode.id,
        kind: selectedNode.type,
        label: selectedNode.data.label ?? selectedNode.id,
        path: [],
        type: "node",
      });
    }

    const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId);
    if (selectedEdge) {
      canvasRefs.push({
        baseId: selectedEdge.id,
        id: selectedEdge.id,
        kind: "edge",
        label: selectedEdge.data?.label || `${selectedEdge.source} -> ${selectedEdge.target}`,
        path: [],
        type: "edge",
      });
    }

    const refLabelById = Object.fromEntries(
      nodes.map((node) => [node.id, node.data.label ?? node.id]),
    );

    return buildAgentContext({
      activeJob: activeJobId && isRunning ? { id: activeJobId, status: "running" } : null,
      anchorCounts: countAnchorsByRef(messages),
      canvasRefs,
      dismissed: [],
      hasConversation: messages.length > 0,
      latestJob: null,
      nodeRunStatuses,
      pipelineId,
      pipelineName,
      refLabelById,
    });
  }, [
    activeJobId,
    edges,
    isRunning,
    messages,
    nodeRunStatuses,
    nodes,
    pipelineId,
    pipelineName,
    selectedEdgeId,
    selectedNodeId,
  ]);
};

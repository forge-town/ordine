import { useMemo } from "react";
import { useStore } from "zustand";
import type { CompoundNodeData } from "@repo/schemas";
import { useCanvasPageStore } from "../_store";
import type { PipelineEdge, PipelineNode } from "../_store/canvasSlice";

export interface DrillBreadcrumb {
  id: string;
  label: string;
}

export const useDrillStack = () => {
  const store = useCanvasPageStore();
  const nodes = useStore(store, (state) => state.nodes);
  const edges = useStore(store, (state) => state.edges);
  const drillStack = useStore(store, (state) => state.drillStack);
  const setDrillStack = useStore(store, (state) => state.setDrillStack);
  const activeCompoundId = drillStack.at(-1) ?? null;
  const activeCompound = useMemo(
    () => nodes.find((node) => node.id === activeCompoundId && node.type === "compound") ?? null,
    [activeCompoundId, nodes],
  );
  const activeCompoundData = activeCompound?.data as CompoundNodeData | undefined;
  const visibleNodes = useMemo<PipelineNode[]>(() => {
    if (!activeCompoundData) {
      return nodes;
    }

    const childIdSet = new Set(activeCompoundData.childNodeIds);

    return nodes
      .filter((node) => childIdSet.has(node.id))
      .map((node) => ({
        ...node,
        extent: undefined,
        parentId: undefined,
      }));
  }, [activeCompoundData, nodes]);
  const visibleEdges = useMemo<PipelineEdge[]>(() => {
    if (!activeCompoundData) {
      return edges;
    }

    return activeCompoundData.childEdges.map(
      (edge) =>
        ({
          ...edge,
          animated: true,
          type: "semantic",
        }) as PipelineEdge,
    );
  }, [activeCompoundData, edges]);
  const breadcrumbs = useMemo<DrillBreadcrumb[]>(
    () =>
      drillStack.map((id) => {
        const node = nodes.find((item) => item.id === id);

        return {
          id,
          label: String(node?.data.label ?? id),
        };
      }),
    [drillStack, nodes],
  );

  const exitToDepth = (depth: number) => {
    setDrillStack(drillStack.slice(0, depth));
  };

  return {
    activeCompound,
    activeCompoundId,
    breadcrumbs,
    exitToDepth,
    visibleEdges,
    visibleNodes,
  };
};

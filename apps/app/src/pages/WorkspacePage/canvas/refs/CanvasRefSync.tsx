import { useEffect } from "react";
import { useReactFlow } from "@xyflow/react";
import { useWorkspaceStore } from "../../_store/workspaceStore";
import { useCanvasStore } from "../_store/canvasStore";

const FOCUS_ZOOM = 0.92;
const NODE_CENTER_OFFSET = { x: 120, y: 60 };

/**
 * Bridges canvas selection into the workspace store (Select → Prompt),
 * and consumes spotlight requests (chip click → drill + center on target).
 */
export const CanvasRefSync = () => {
  const selectedIds = useCanvasStore((state) => state.selectedIds);
  const drillStack = useCanvasStore((state) => state.drillStack);
  const nodes = useCanvasStore((state) => state.nodes);
  const edges = useCanvasStore((state) => state.edges);
  const getSelectedRefs = useCanvasStore((state) => state.getSelectedRefs);
  const setDrillStack = useCanvasStore((state) => state.setDrillStack);
  const setSelectedIds = useCanvasStore((state) => state.setSelectedIds);
  const openEdgeInspector = useCanvasStore((state) => state.openEdgeInspector);
  const setCanvasRefs = useWorkspaceStore((state) => state.setCanvasRefs);
  const spotlight = useWorkspaceStore((state) => state.spotlight);
  const { setCenter } = useReactFlow();

  useEffect(() => {
    setCanvasRefs(getSelectedRefs());
    // selectedIds/drillStack drive the visible selection; nodes/edges affect labels.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drillStack, getSelectedRefs, selectedIds, setCanvasRefs]);

  useEffect(() => {
    if (!spotlight) {
      return;
    }

    const { ref } = spotlight;
    setDrillStack(ref.path);

    if (ref.type === "node") {
      const node = nodes.find((item) => item.id === ref.baseId);
      if (!node) {
        return;
      }
      setSelectedIds([node.id]);
      void setCenter(
        node.position.x + NODE_CENTER_OFFSET.x,
        node.position.y + NODE_CENTER_OFFSET.y,
        { duration: 300, zoom: FOCUS_ZOOM },
      );

      return;
    }

    const edge =
      edges.find((item) => item.id === ref.baseId) ??
      nodes
        .flatMap((node) =>
          node.type === "compound"
            ? ((node.data as { childEdges?: typeof edges }).childEdges ?? [])
            : [],
        )
        .find((item) => item.id === ref.baseId);
    if (!edge) {
      return;
    }

    const source = nodes.find((item) => item.id === edge.source);
    const target = nodes.find((item) => item.id === edge.target);
    if (source && target) {
      void setCenter(
        (source.position.x + target.position.x) / 2 + NODE_CENTER_OFFSET.x,
        (source.position.y + target.position.y) / 2 + NODE_CENTER_OFFSET.y,
        { duration: 300, zoom: FOCUS_ZOOM },
      );
    }
    openEdgeInspector(edge.id);
    // Only react to a new spotlight request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spotlight?.nonce]);

  return null;
};

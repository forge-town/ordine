import { ArrowRightLeft, RotateCcw, ShieldCheck } from "lucide-react";
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import { useTranslation } from "react-i18next";
import { cn } from "@repo/ui/lib/utils";
import type { PipelineEdgeData } from "@repo/schemas";
import { useCanvasStore } from "../_store/canvasStore";

type SemanticEdgeState = "idle" | "pending" | "flow" | "done" | "selected";

const edgeStateClass: Record<SemanticEdgeState, string> = {
  idle: "stroke-muted-foreground/45",
  pending: "stroke-muted-foreground/40 opacity-60",
  flow: "stroke-foreground edge-flow",
  done: "stroke-success",
  selected: "stroke-foreground",
};

const edgeLabelClass: Record<SemanticEdgeState, string> = {
  idle: "bg-surface text-foreground/80 ring-border",
  pending: "bg-surface text-muted-foreground ring-border opacity-70",
  flow: "bg-foreground text-primary-foreground ring-foreground",
  done: "bg-success/10 text-success ring-success/20",
  selected: "bg-foreground text-primary-foreground ring-foreground",
};

const getSemanticEdgeState = (
  selected: boolean | undefined,
  phase: string,
  sourceStatus?: string,
  targetStatus?: string,
): SemanticEdgeState => {
  if (selected) return "selected";
  if (phase === "proposal") return "pending";
  if (sourceStatus === "done" && targetStatus === "running") return "flow";
  if (sourceStatus === "done" && targetStatus === "done") return "done";

  return "idle";
};

export const SemanticEdge = ({
  data,
  id,
  selected,
  source,
  sourceX,
  sourceY,
  sourcePosition,
  target,
  targetX,
  targetY,
  targetPosition,
}: EdgeProps) => {
  const { t } = useTranslation();
  const edgeData = data as PipelineEdgeData | undefined;
  const pendingProposal = useCanvasStore((state) => state.pendingProposal);
  const sourceStatus = useCanvasStore((state) => state.nodeRunStatuses[source]);
  const targetStatus = useCanvasStore((state) => state.nodeRunStatuses[target]);
  const inspectEdgeId = useCanvasStore((state) => state.inspectEdgeId);
  const [edgePath, labelX, labelY] = getBezierPath({
    sourcePosition,
    sourceX,
    sourceY,
    targetPosition,
    targetX,
    targetY,
  });
  const semanticState = getSemanticEdgeState(
    selected || inspectEdgeId === id,
    pendingProposal ? "proposal" : "applied",
    sourceStatus,
    targetStatus,
  );
  const label = edgeData?.label || t("workspace.canvas.edges.defaultLabel");
  const isLoopEdge = Boolean(edgeData?.condition);
  const Icon = edgeData?.qualityGate ? ShieldCheck : isLoopEdge ? RotateCcw : ArrowRightLeft;

  return (
    <>
      <BaseEdge
        className={cn(
          "stroke-[2px]",
          edgeStateClass[semanticState],
          isLoopEdge && "stroke-warning [stroke-dasharray:6_4]",
        )}
        id={id}
        path={edgePath}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan absolute -translate-x-1/2 -translate-y-1/2"
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
        >
          <div
            className={cn(
              "flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] shadow-soft ring-1 transition-all",
              edgeLabelClass[semanticState],
              isLoopEdge && "bg-warning/10 text-foreground ring-warning/30",
            )}
            data-testid="canvas-v2-semantic-edge-label"
          >
            <Icon className="h-2.5 w-2.5" />
            <span className="max-w-28 truncate font-mono">{label}</span>
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

import { ArrowRightLeft, Unlink, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import type { PipelineEdgeData } from "@repo/schemas";
import { useCanvasStore, useCanvasStoreApi } from "../../_store/canvasStore";
import { toPipelineSnapshot } from "../../_store/canvasTypes";
import { EdgeMappingsSection } from "./EdgeMappingsSection";
import { EdgeQualityGateSection } from "./EdgeQualityGateSection";
import { EdgeTransformSection } from "./EdgeTransformSection";
import { usePipelineSnapshotPersistence } from "../usePipelineSnapshotPersistence";

export type EdgeInspectorProps = {
  pipelineId: string;
};

export const EdgeInspector = ({ pipelineId }: EdgeInspectorProps) => {
  const { t } = useTranslation();
  const inspectEdgeId = useCanvasStore((state) => state.inspectEdgeId);
  const drillStack = useCanvasStore((state) => state.drillStack);
  const nodes = useCanvasStore((state) => state.nodes);
  const edges = useCanvasStore((state) => state.edges);
  const updateEdgeData = useCanvasStore((state) => state.updateEdgeData);
  const deleteEdge = useCanvasStore((state) => state.deleteEdge);
  const setInspectEdgeId = useCanvasStore((state) => state.setInspectEdgeId);
  const canvasStore = useCanvasStoreApi();
  const persistSnapshot = usePipelineSnapshotPersistence(pipelineId);
  const activeCompound = nodes.find((node) => node.id === drillStack.at(-1));
  const childEdges =
    activeCompound?.data.nodeType === "compound" ? (activeCompound.data.childEdges ?? []) : [];
  const edge =
    edges.find((item) => item.id === inspectEdgeId) ??
    childEdges.find((item) => item.id === inspectEdgeId);

  if (!edge) {
    return null;
  }

  const edgeData: PipelineEdgeData = { label: edge.data?.label ?? "", ...edge.data };
  const sourceLabel = nodes.find((node) => node.id === edge.source)?.data.label ?? edge.source;
  const targetLabel = nodes.find((node) => node.id === edge.target)?.data.label ?? edge.target;
  const handleClose = () => setInspectEdgeId(null);

  const handleEdgeDataChange = (nextData: PipelineEdgeData) => {
    updateEdgeData(edge.id, nextData);
    const state = canvasStore.getState();
    persistSnapshot(toPipelineSnapshot({ edges: state.edges, nodes: state.nodes }));
  };

  const handleDelete = () => {
    deleteEdge(edge.id);
    const state = canvasStore.getState();
    persistSnapshot(toPipelineSnapshot({ edges: state.edges, nodes: state.nodes }));
    setInspectEdgeId(null);
  };

  const handleConditionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const expression = event.target.value.trim();
    handleEdgeDataChange({
      ...edgeData,
      condition: expression ? { ...edgeData.condition, expression } : undefined,
    });
  };

  return (
    <aside
      aria-label={t("workspace.canvas.edgeInspector.title")}
      className="absolute bottom-20 left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-[420px] -translate-x-1/2 flex-col overflow-hidden rounded-2xl bg-card shadow-xl ring-1 ring-border"
      data-testid="canvas-v2-edge-inspector"
      role="dialog"
    >
      <div className="flex items-center gap-2 border-b border-border/70 px-3.5 py-2.5">
        <div className="flex size-6 items-center justify-center rounded-md bg-muted">
          <ArrowRightLeft className="size-3.5 text-foreground/80" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold">{t("workspace.canvas.edgeInspector.title")}</div>
          <div className="truncate text-[10px] text-muted-foreground">
            {sourceLabel} <span className="px-1 text-foreground/40">→</span> {targetLabel}
          </div>
        </div>
        <Button
          aria-label={t("workspace.canvas.edgeInspector.deleteEdge")}
          data-testid="edge-inspector-delete"
          size="icon"
          variant="ghost"
          onClick={handleDelete}
        >
          <Unlink className="size-3.5" />
        </Button>
        <Button
          aria-label={t("workspace.canvas.edgeInspector.close")}
          data-testid="edge-inspector-close"
          size="icon"
          variant="ghost"
          onClick={handleClose}
        >
          <X className="size-3.5" />
        </Button>
      </div>

      <div className="max-h-[50vh] space-y-3 overflow-y-auto px-3.5 py-3">
        <EdgeMappingsSection edgeData={edgeData} onChange={handleEdgeDataChange} />

        <div className="space-y-2 rounded-xl bg-muted/60 px-2.5 py-2 ring-1 ring-border">
          <Label className="text-[11px] font-medium text-muted-foreground" htmlFor="edge-condition">
            {t("workspace.canvas.edgeInspector.condition")}
          </Label>
          <Input
            data-testid="edge-inspector-condition"
            id="edge-condition"
            placeholder='content.includes("approved")'
            value={edgeData.condition?.expression ?? ""}
            onChange={handleConditionChange}
          />
        </div>

        <EdgeTransformSection edgeData={edgeData} onChange={handleEdgeDataChange} />
        <EdgeQualityGateSection edgeData={edgeData} onChange={handleEdgeDataChange} />
      </div>
    </aside>
  );
};

import { useContext } from "react";
import { useUpdate } from "@refinedev/core";
import { Group, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { toPipelineSnapshot } from "../_store/canvasTypes";
import { CanvasStoreContext, useCanvasStore } from "../_store/canvasStore";

export type ComposeBarProps = {
  pipelineId: string;
};

export const ComposeBar = ({ pipelineId }: ComposeBarProps) => {
  const { t } = useTranslation();
  const store = useContext(CanvasStoreContext);
  const nodes = useCanvasStore((state) => state.nodes);
  const selectedIds = useCanvasStore((state) => state.selectedIds);
  const configNodeId = useCanvasStore((state) => state.configNodeId);
  const composeNodes = useCanvasStore((state) => state.composeNodes);
  const setSelectedIds = useCanvasStore((state) => state.setSelectedIds);
  const { mutate: updatePipeline } = useUpdate();
  const selectedNodeIds = selectedIds.filter((id) =>
    nodes.some((node) => node.id === id && node.type !== "compound"),
  );

  if (selectedNodeIds.length < 2 || configNodeId) {
    return null;
  }

  const handleCompose = () => {
    const compound = composeNodes(selectedNodeIds, {
      label: t("workspace.canvas.compose.defaultLabel"),
    });
    if (!compound) {
      return;
    }

    setSelectedIds([compound.id]);
    const next = store?.getState();
    if (!next) {
      return;
    }
    updatePipeline({
      errorNotification: false,
      id: pipelineId,
      resource: ResourceName.pipelines,
      successNotification: false,
      values: toPipelineSnapshot({ edges: next.edges, nodes: next.nodes }),
    });
  };
  const handleClear = () => setSelectedIds([]);

  return (
    <div className="pointer-events-auto absolute left-1/2 top-16 z-30 -translate-x-1/2">
      <div
        className="flex items-center gap-2 rounded-full bg-foreground px-2 py-1.5 text-background shadow-float"
        data-testid="canvas-v2-compose-bar"
      >
        <span className="pl-1.5 text-xs">
          {t("workspace.canvas.compose.selected", { count: selectedNodeIds.length })}
        </span>
        <span className="h-3.5 w-px bg-background/25" />
        <button
          className="flex items-center gap-1.5 rounded-full bg-background/15 px-2.5 py-1 text-xs font-medium transition-colors hover:bg-background/25"
          data-testid="canvas-v2-compose-action"
          type="button"
          onClick={handleCompose}
        >
          <Group className="size-3" />
          {t("workspace.canvas.compose.compose")}
        </button>
        <button
          aria-label={t("common.clear")}
          className="rounded-full p-1 text-background/70 transition-colors hover:bg-background/15"
          data-testid="canvas-v2-compose-clear"
          type="button"
          onClick={handleClear}
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
};

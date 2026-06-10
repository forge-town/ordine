import { X } from "lucide-react";
import { useUpdate } from "@refinedev/core";
import { useStore } from "zustand";
import { Button } from "@repo/ui/button";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { useCanvasPageStore } from "../_store";
import type { PipelineEdge } from "../_store/canvasSlice";

const getEdgeMappings = (edge: PipelineEdge) => edge.data?.dataContract?.mappings ?? [];

export const EdgeInspector = () => {
  const store = useCanvasPageStore();
  const inspectEdgeId = useStore(store, (state) => state.inspectEdgeId);
  const edges = useStore(store, (state) => state.edges);
  const pipelineId = useStore(store, (state) => state.pipelineId);
  const updateEdgeData = useStore(store, (state) => state.updateEdgeData);
  const setInspectEdgeId = useStore(store, (state) => state.setInspectEdgeId);
  const { mutate: updatePipeline } = useUpdate();
  const edge = edges.find((item) => item.id === inspectEdgeId);

  if (!edge) {
    return null;
  }

  const mappings = getEdgeMappings(edge);

  const handleClose = () => {
    setInspectEdgeId(null);
  };

  const handleMappingToggle = (mappingIndex: number, enabled: boolean) => {
    const nextMappings = mappings.map((mapping, index) =>
      index === mappingIndex ? { ...mapping, enabled } : mapping,
    );
    const nextData = {
      ...edge.data,
      dataContract: {
        ...edge.data?.dataContract,
        mappings: nextMappings,
      },
    };
    const nextEdges = edges.map((item) =>
      item.id === edge.id ? { ...item, data: nextData } : item,
    );

    updateEdgeData(edge.id, nextData);

    if (pipelineId) {
      updatePipeline({
        resource: ResourceName.pipelines,
        id: pipelineId,
        values: { edges: nextEdges },
        successNotification: false,
        errorNotification: false,
      });
    }
  };

  return (
    <aside className="absolute bottom-4 right-4 z-30 flex w-[320px] flex-col rounded-xl bg-surface shadow-float ring-1 ring-border">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-semibold">Edge Inspector</div>
          <div className="truncate text-[10.5px] text-muted-foreground">
            {edge.source}
            {" -> "}
            {edge.target}
          </div>
        </div>
        <Button aria-label="Close Edge Inspector" size="icon" variant="ghost" onClick={handleClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-2 p-3">
        <div className="rounded-lg bg-background px-2.5 py-2 ring-1 ring-border">
          <div className="text-[11px] font-medium text-muted-foreground">Label</div>
          <div className="mt-1 truncate text-[12px]">{edge.data?.label || "data"}</div>
        </div>

        <div>
          <div className="mb-1.5 text-[11px] font-medium text-muted-foreground">Mappings</div>
          {mappings.length > 0 ? (
            <div className="space-y-1.5">
              {mappings.map((mapping, index) => (
                <label
                  key={`${mapping.fromField}-${mapping.toInput}-${index}`}
                  className="flex items-center gap-2 rounded-lg bg-background px-2.5 py-2 text-[12px] ring-1 ring-border"
                >
                  <input
                    checked={mapping.enabled}
                    className="h-3.5 w-3.5 accent-foreground"
                    type="checkbox"
                    onChange={(event) => handleMappingToggle(index, event.target.checked)}
                  />
                  <span className="min-w-0 flex-1 truncate font-mono">
                    {mapping.fromField}
                    {" -> "}
                    {mapping.toInput}
                  </span>
                  {mapping.type ? (
                    <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {mapping.type}
                    </span>
                  ) : null}
                </label>
              ))}
            </div>
          ) : (
            <div className="rounded-lg bg-background px-2.5 py-2 text-[12px] text-muted-foreground ring-1 ring-border">
              No field mappings yet.
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

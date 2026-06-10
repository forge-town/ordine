import { X } from "lucide-react";
import { useUpdate } from "@refinedev/core";
import { useStore } from "zustand";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { useCanvasPageStore } from "../_store";
import type { PipelineEdge } from "../_store/canvasSlice";
import type { PipelineEdgeData } from "@repo/schemas";

const getEdgeMappings = (edge: PipelineEdge) => edge.data?.dataContract?.mappings ?? [];
const transformOptions = ["trim", "uppercase", "lowercase"] as const;

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

  const persistEdgeData = (nextData: PipelineEdgeData) => {
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

  const handleMappingToggle = (mappingIndex: number, enabled: boolean) => {
    const nextMappings = mappings.map((mapping, index) =>
      index === mappingIndex ? { ...mapping, enabled } : mapping,
    );

    persistEdgeData({
      ...edge.data,
      dataContract: {
        ...edge.data?.dataContract,
        mappings: nextMappings,
      },
    });
  };

  const handleConditionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const expression = event.target.value.trim();

    persistEdgeData({
      ...edge.data,
      condition: expression ? { ...edge.data?.condition, expression } : undefined,
    });
  };

  const handleTransformAdd = (type: (typeof transformOptions)[number]) => {
    persistEdgeData({
      ...edge.data,
      transform: {
        steps: [...(edge.data?.transform?.steps ?? []), { type, config: {} }],
      },
    });
  };

  const handleTransformClear = () => {
    persistEdgeData({
      ...edge.data,
      transform: undefined,
    });
  };

  const handleQualityCriteriaChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const criteria = event.target.value.trim();

    persistEdgeData({
      ...edge.data,
      qualityGate: criteria
        ? {
            criteria,
            maxRetries: edge.data?.qualityGate?.maxRetries,
            onFail: edge.data?.qualityGate?.onFail ?? "skip",
          }
        : undefined,
    });
  };

  const handleQualityRetriesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.valueAsNumber;
    if (!edge.data?.qualityGate || !Number.isFinite(value)) return;

    persistEdgeData({
      ...edge.data,
      qualityGate: {
        ...edge.data.qualityGate,
        maxRetries: Math.max(0, Math.floor(value)),
      },
    });
  };

  const handleQualityOnFailChange = (value: "retry" | "skip" | "fail") => {
    if (!edge.data?.qualityGate) return;

    persistEdgeData({
      ...edge.data,
      qualityGate: {
        ...edge.data.qualityGate,
        onFail: value,
      },
    });
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

        <div className="space-y-2 rounded-lg bg-background px-2.5 py-2 ring-1 ring-border">
          <Label className="text-[11px] font-medium text-muted-foreground" htmlFor="edge-condition">
            Condition
          </Label>
          <Input
            id="edge-condition"
            placeholder='content.includes("approved")'
            value={edge.data?.condition?.expression ?? ""}
            onChange={handleConditionChange}
          />
        </div>

        <div className="space-y-2 rounded-lg bg-background px-2.5 py-2 ring-1 ring-border">
          <div className="text-[11px] font-medium text-muted-foreground">Transform</div>
          <div className="flex flex-wrap gap-1.5">
            {transformOptions.map((type) => (
              <Button
                key={type}
                className="h-7 px-2 text-[11px]"
                size="sm"
                type="button"
                variant="secondary"
                onClick={() => handleTransformAdd(type)}
              >
                {type}
              </Button>
            ))}
            <Button
              className="h-7 px-2 text-[11px]"
              size="sm"
              type="button"
              variant="ghost"
              onClick={handleTransformClear}
            >
              Clear
            </Button>
          </div>
          <div className="text-[11px] text-muted-foreground">
            {(edge.data?.transform?.steps ?? []).map((step) => step.type).join(" -> ") ||
              "No transform steps."}
          </div>
        </div>

        <div className="space-y-2 rounded-lg bg-background px-2.5 py-2 ring-1 ring-border">
          <Label className="text-[11px] font-medium text-muted-foreground" htmlFor="edge-quality">
            Quality Gate
          </Label>
          <Input
            id="edge-quality"
            placeholder="non-empty or required text"
            value={edge.data?.qualityGate?.criteria ?? ""}
            onChange={handleQualityCriteriaChange}
          />
          <div className="grid grid-cols-[1fr_1.4fr] gap-2">
            <Input
              aria-label="Quality gate retries"
              inputMode="numeric"
              min={0}
              step={1}
              type="number"
              value={edge.data?.qualityGate?.maxRetries ?? 0}
              onChange={handleQualityRetriesChange}
            />
            <Select
              value={edge.data?.qualityGate?.onFail ?? "skip"}
              onValueChange={(value) =>
                handleQualityOnFailChange(value as "retry" | "skip" | "fail")
              }
            >
              <SelectTrigger aria-label="Quality gate failure action">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="retry">retry</SelectItem>
                <SelectItem value="skip">skip</SelectItem>
                <SelectItem value="fail">fail</SelectItem>
              </SelectContent>
            </Select>
          </div>
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

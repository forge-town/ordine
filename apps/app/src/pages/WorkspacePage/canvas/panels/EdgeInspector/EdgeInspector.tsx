import { useUpdate } from "@refinedev/core";
import { ArrowRightLeft, Info, Unlink, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
import type { PipelineEdgeData } from "@repo/schemas";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { toPipelineSnapshot } from "../../_store/canvasTypes";
import { useCanvasStore } from "../../_store/canvasStore";

export type EdgeInspectorProps = {
  pipelineId: string;
};

const TRANSFORM_OPTIONS = ["trim", "uppercase", "lowercase"] as const;
const ON_FAIL_OPTIONS = ["retry", "skip", "fail"] as const;

export const EdgeInspector = ({ pipelineId }: EdgeInspectorProps) => {
  const { t } = useTranslation();
  const inspectEdgeId = useCanvasStore((state) => state.inspectEdgeId);
  const nodes = useCanvasStore((state) => state.nodes);
  const edges = useCanvasStore((state) => state.edges);
  const updateEdgeData = useCanvasStore((state) => state.updateEdgeData);
  const deleteEdge = useCanvasStore((state) => state.deleteEdge);
  const recordHistory = useCanvasStore((state) => state.recordHistory);
  const setInspectEdgeId = useCanvasStore((state) => state.setInspectEdgeId);
  const { mutate: updatePipeline } = useUpdate();
  const edge = edges.find((item) => item.id === inspectEdgeId);

  if (!edge) {
    return null;
  }

  const edgeData: PipelineEdgeData = { label: edge.data?.label ?? "", ...edge.data };
  const mappings = edgeData.dataContract?.mappings ?? [];
  const sourceLabel =
    (nodes.find((node) => node.id === edge.source)?.data as { label?: string } | undefined)
      ?.label ?? edge.source;
  const targetLabel =
    (nodes.find((node) => node.id === edge.target)?.data as { label?: string } | undefined)
      ?.label ?? edge.target;

  const handleClose = () => setInspectEdgeId(null);

  const persistEdges = (nextEdges: typeof edges) => {
    updatePipeline({
      errorNotification: false,
      id: pipelineId,
      resource: ResourceName.pipelines,
      successNotification: false,
      values: { edges: toPipelineSnapshot({ edges: nextEdges, nodes }).edges },
    });
  };

  const persistEdgeData = (nextData: PipelineEdgeData) => {
    const nextEdges = edges.map((item) =>
      item.id === edge.id ? { ...item, data: nextData } : item,
    );
    updateEdgeData(edge.id, nextData);
    persistEdges(nextEdges);
  };

  const handleMappingToggle = (mappingIndex: number) => {
    const nextMappings = mappings.map((mapping, index) =>
      index === mappingIndex ? { ...mapping, enabled: !mapping.enabled } : mapping,
    );
    persistEdgeData({
      ...edgeData,
      dataContract: { ...edgeData.dataContract, mappings: nextMappings },
    });
  };

  const handleDelete = () => {
    recordHistory({ edges, nodes });
    deleteEdge(edge.id);
    persistEdges(edges.filter((item) => item.id !== edge.id));
    setInspectEdgeId(null);
  };

  const handleConditionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const expression = event.target.value;
    persistEdgeData({
      ...edgeData,
      condition: expression.trim()
        ? { ...edgeData.condition, expression: expression.trim() }
        : undefined,
    });
  };

  const handleTransformAdd = (type: (typeof TRANSFORM_OPTIONS)[number]) => {
    persistEdgeData({
      ...edgeData,
      transform: { steps: [...(edgeData.transform?.steps ?? []), { config: {}, type }] },
    });
  };

  const handleQualityCriteriaChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const criteria = event.target.value.trim();
    persistEdgeData({
      ...edgeData,
      qualityGate: criteria
        ? {
            criteria,
            maxRetries: edgeData.qualityGate?.maxRetries,
            onFail: edgeData.qualityGate?.onFail ?? "skip",
          }
        : undefined,
    });
  };

  const enabledCount = mappings.filter((mapping) => mapping.enabled).length;

  return (
    <aside
      className="absolute bottom-20 left-1/2 z-30 flex w-[420px] -translate-x-1/2 flex-col overflow-hidden rounded-2xl bg-surface shadow-float ring-1 ring-border-strong"
      data-testid="canvas-v2-edge-inspector"
    >
      <div className="flex items-center gap-2 border-b border-border/70 px-3.5 py-2.5">
        <div className="flex size-6 items-center justify-center rounded-md bg-surface-2">
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
        {mappings.length > 0 ? (
          <div>
            <div className="mb-2 grid grid-cols-[1fr_auto_1fr] gap-2 px-1 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              <span>{t("workspace.canvas.edgeInspector.sourceField")}</span>
              <span>{t("workspace.canvas.edgeInspector.flow")}</span>
              <span>{t("workspace.canvas.edgeInspector.targetInput")}</span>
            </div>
            <div className="space-y-1.5">
              {mappings.map((mapping, index) => (
                <button
                  key={`${mapping.fromField}-${mapping.toInput}-${index}`}
                  className={cn(
                    "grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl px-2.5 py-2 text-left ring-1 transition-all",
                    mapping.enabled
                      ? "bg-surface-2 ring-border hover:ring-border-strong"
                      : "bg-surface opacity-55 ring-border/60 hover:opacity-80",
                  )}
                  data-testid={`edge-inspector-mapping-${index}`}
                  type="button"
                  onClick={() => handleMappingToggle(index)}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-mono text-[11px] font-medium">
                      {mapping.fromField}
                    </span>
                    {mapping.type ? (
                      <span className="block truncate text-[9.5px] text-muted-foreground">
                        {mapping.type}
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={cn(
                      "flex h-4 w-7 items-center rounded-full p-0.5 transition-colors",
                      mapping.enabled ? "bg-foreground" : "bg-surface-3",
                    )}
                  >
                    <span
                      className={cn(
                        "size-3 rounded-full bg-surface transition-transform",
                        mapping.enabled && "translate-x-3",
                      )}
                    />
                  </span>
                  <span
                    className={cn(
                      "truncate font-mono text-[11px]",
                      !mapping.enabled && "line-through",
                    )}
                  >
                    {mapping.enabled
                      ? mapping.toInput
                      : t("workspace.canvas.edgeInspector.dropped")}
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
              <Info className="size-3" />
              {t("workspace.canvas.edgeInspector.toggleHint", {
                enabled: enabledCount,
                total: mappings.length,
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-surface-2 p-3 text-xs text-muted-foreground ring-1 ring-border">
            {t("workspace.canvas.edgeInspector.noMappings")}
          </div>
        )}

        <div className="space-y-2 rounded-xl bg-surface-2/60 px-2.5 py-2 ring-1 ring-border">
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

        <div className="space-y-2 rounded-xl bg-surface-2/60 px-2.5 py-2 ring-1 ring-border">
          <div className="text-[11px] font-medium text-muted-foreground">
            {t("workspace.canvas.edgeInspector.transform")}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TRANSFORM_OPTIONS.map((type) => (
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
              onClick={() => persistEdgeData({ ...edgeData, transform: undefined })}
            >
              {t("workspace.canvas.edgeInspector.clear")}
            </Button>
          </div>
          <div className="text-[11px] text-muted-foreground">
            {(edgeData.transform?.steps ?? []).map((step) => step.type).join(" → ") ||
              t("workspace.canvas.edgeInspector.noTransform")}
          </div>
        </div>

        <div className="space-y-2 rounded-xl bg-surface-2/60 px-2.5 py-2 ring-1 ring-border">
          <Label className="text-[11px] font-medium text-muted-foreground" htmlFor="edge-quality">
            {t("workspace.canvas.edgeInspector.qualityGate")}
          </Label>
          <Input
            data-testid="edge-inspector-quality"
            id="edge-quality"
            placeholder={t("workspace.canvas.edgeInspector.qualityPlaceholder")}
            value={edgeData.qualityGate?.criteria ?? ""}
            onChange={handleQualityCriteriaChange}
          />
          {edgeData.qualityGate ? (
            <div className="grid grid-cols-[1fr_1.4fr] gap-2">
              <Input
                aria-label={t("workspace.canvas.edgeInspector.maxRetries")}
                inputMode="numeric"
                min={0}
                step={1}
                type="number"
                value={edgeData.qualityGate.maxRetries ?? 0}
                onChange={(event) => {
                  const value = event.target.valueAsNumber;
                  if (!Number.isFinite(value) || !edgeData.qualityGate) {
                    return;
                  }
                  persistEdgeData({
                    ...edgeData,
                    qualityGate: {
                      ...edgeData.qualityGate,
                      maxRetries: Math.max(0, Math.floor(value)),
                    },
                  });
                }}
              />
              <Select
                value={edgeData.qualityGate.onFail}
                onValueChange={(value) => {
                  if (!value || !edgeData.qualityGate) {
                    return;
                  }
                  persistEdgeData({
                    ...edgeData,
                    qualityGate: {
                      ...edgeData.qualityGate,
                      onFail: value as (typeof ON_FAIL_OPTIONS)[number],
                    },
                  });
                }}
              >
                <SelectTrigger aria-label={t("workspace.canvas.edgeInspector.onFail")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ON_FAIL_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
};

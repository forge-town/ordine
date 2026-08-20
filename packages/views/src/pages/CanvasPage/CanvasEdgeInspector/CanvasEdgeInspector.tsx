import { ArrowRightLeft, Info, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import type { PipelineEdgeData } from "@repo/schemas";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
import { cn } from "@repo/ui/lib/utils";
import { useCanvasPageStore } from "../_store";

const TRANSFORM_OPTIONS = ["trim", "uppercase", "lowercase"] as const;
const ON_FAIL_OPTIONS = ["retry", "skip", "fail"] as const;

export const CanvasEdgeInspector = () => {
  const { t } = useTranslation();
  const store = useCanvasPageStore();
  const selectedEdgeId = useStore(store, (state) => state.selectedEdgeId);
  const edges = useStore(store, (state) => state.edges);
  const nodes = useStore(store, (state) => state.nodes);
  const updateEdgeData = useStore(store, (state) => state.updateEdgeData);
  const clearSelection = useStore(store, (state) => state.clearSelection);
  const edge = edges.find((item) => item.id === selectedEdgeId);

  if (!edge) {
    return null;
  }

  const edgeData: PipelineEdgeData = { label: edge.data?.label ?? "", ...edge.data };
  const mappings = edgeData.dataContract?.mappings ?? [];
  const sourceLabel = nodes.find((node) => node.id === edge.source)?.data.label ?? edge.source;
  const targetLabel = nodes.find((node) => node.id === edge.target)?.data.label ?? edge.target;
  const enabledCount = mappings.filter((mapping) => mapping.enabled).length;
  const handleClose = () => clearSelection();

  const handleMappingToggle = (mappingIndex: number) => {
    const nextMappings = mappings.map((mapping, index) =>
      index === mappingIndex ? { ...mapping, enabled: !mapping.enabled } : mapping,
    );
    updateEdgeData(edge.id, {
      dataContract: { ...edgeData.dataContract, mappings: nextMappings },
    });
  };

  const handleConditionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const expression = event.currentTarget.value.trim();
    updateEdgeData(edge.id, {
      condition: expression ? { ...edgeData.condition, expression } : undefined,
    });
  };

  const handleTransformAdd = (type: (typeof TRANSFORM_OPTIONS)[number]) => {
    updateEdgeData(edge.id, {
      transform: {
        steps: [...(edgeData.transform?.steps ?? []), { config: {}, type }],
      },
    });
  };

  const handleTransformClear = () => updateEdgeData(edge.id, { transform: undefined });

  const handleQualityCriteriaChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const criteria = event.currentTarget.value.trim();
    updateEdgeData(edge.id, {
      qualityGate: criteria
        ? {
            criteria,
            maxRetries: edgeData.qualityGate?.maxRetries,
            onFail: edgeData.qualityGate?.onFail ?? "skip",
          }
        : undefined,
    });
  };

  const handleQualityRetriesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const maxRetries = event.currentTarget.valueAsNumber;
    if (!Number.isFinite(maxRetries) || !edgeData.qualityGate) {
      return;
    }

    updateEdgeData(edge.id, {
      qualityGate: {
        ...edgeData.qualityGate,
        maxRetries: Math.max(0, Math.floor(maxRetries)),
      },
    });
  };

  const handleQualityFailureChange = (value: string | null) => {
    if (!value || !edgeData.qualityGate) {
      return;
    }

    updateEdgeData(edge.id, {
      qualityGate: {
        ...edgeData.qualityGate,
        onFail: value as (typeof ON_FAIL_OPTIONS)[number],
      },
    });
  };

  return (
    <aside
      className="absolute bottom-20 left-1/2 z-30 flex w-[420px] max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-col overflow-hidden rounded-2xl bg-surface shadow-float ring-1 ring-border-strong"
      data-testid="canvas-edge-inspector"
    >
      <div className="flex items-center gap-2 border-b border-border/70 px-3.5 py-2.5">
        <div className="flex size-6 items-center justify-center rounded-md bg-surface-2">
          <ArrowRightLeft className="size-3.5 text-foreground/80" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold">
            {t("canvas.edgeInspector.title", { defaultValue: "Data Contract" })}
          </div>
          <div className="truncate text-[10px] text-muted-foreground">
            {sourceLabel} <span className="px-1 text-foreground/40">→</span> {targetLabel}
          </div>
        </div>
        <Button
          aria-label={t("canvas.edgeInspector.close", { defaultValue: "Close" })}
          data-testid="canvas-edge-inspector-close"
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
              <span>{t("canvas.edgeInspector.sourceField", { defaultValue: "Source field" })}</span>
              <span>{t("canvas.edgeInspector.flow", { defaultValue: "Flow" })}</span>
              <span>{t("canvas.edgeInspector.targetInput", { defaultValue: "Target input" })}</span>
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
                  data-testid={`canvas-edge-mapping-${index}`}
                  type="button"
                  onClick={() => handleMappingToggle(index)}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-mono text-[11px] font-medium">
                      {mapping.fromField}
                    </span>
                    {mapping.type && (
                      <span className="block truncate text-[9.5px] text-muted-foreground">
                        {mapping.type}
                      </span>
                    )}
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
                      : t("canvas.edgeInspector.dropped", { defaultValue: "dropped" })}
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
              <Info className="size-3" />
              {t("canvas.edgeInspector.toggleHint", {
                defaultValue: "Tap a field to toggle downstream flow · {{enabled}}/{{total}} on",
                enabled: enabledCount,
                total: mappings.length,
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-surface-2 p-3 text-xs text-muted-foreground ring-1 ring-border">
            {t("canvas.edgeInspector.noMappings", {
              defaultValue: "New connection · fields are inferred at run time.",
            })}
          </div>
        )}

        <div className="space-y-2 rounded-xl bg-surface-2/60 px-2.5 py-2 ring-1 ring-border">
          <Label className="text-[11px] font-medium text-muted-foreground" htmlFor="edge-condition">
            {t("canvas.edgeInspector.condition", { defaultValue: "Condition" })}
          </Label>
          <Input
            data-testid="canvas-edge-condition"
            id="edge-condition"
            placeholder='content.includes("approved")'
            value={edgeData.condition?.expression ?? ""}
            onChange={handleConditionChange}
          />
        </div>

        <div className="space-y-2 rounded-xl bg-surface-2/60 px-2.5 py-2 ring-1 ring-border">
          <div className="text-[11px] font-medium text-muted-foreground">
            {t("canvas.edgeInspector.transform", { defaultValue: "Transform" })}
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
              onClick={handleTransformClear}
            >
              {t("canvas.edgeInspector.clear", { defaultValue: "Clear" })}
            </Button>
          </div>
          <div className="text-[11px] text-muted-foreground">
            {(edgeData.transform?.steps ?? []).map((step) => step.type).join(" → ") ||
              t("canvas.edgeInspector.noTransform", { defaultValue: "No transform steps." })}
          </div>
        </div>

        <div className="space-y-2 rounded-xl bg-surface-2/60 px-2.5 py-2 ring-1 ring-border">
          <Label className="text-[11px] font-medium text-muted-foreground" htmlFor="edge-quality">
            {t("canvas.edgeInspector.qualityGate", { defaultValue: "Quality Gate" })}
          </Label>
          <Input
            data-testid="canvas-edge-quality"
            id="edge-quality"
            placeholder={t("canvas.edgeInspector.qualityPlaceholder", {
              defaultValue: "non-empty or required text",
            })}
            value={edgeData.qualityGate?.criteria ?? ""}
            onChange={handleQualityCriteriaChange}
          />
          {edgeData.qualityGate && (
            <div className="grid grid-cols-[1fr_1.4fr] gap-2">
              <Input
                aria-label={t("canvas.edgeInspector.maxRetries", {
                  defaultValue: "Max retries",
                })}
                inputMode="numeric"
                min={0}
                step={1}
                type="number"
                value={edgeData.qualityGate.maxRetries ?? 0}
                onChange={handleQualityRetriesChange}
              />
              <Select
                value={edgeData.qualityGate.onFail}
                onValueChange={handleQualityFailureChange}
              >
                <SelectTrigger
                  aria-label={t("canvas.edgeInspector.onFail", { defaultValue: "On fail" })}
                >
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
          )}
        </div>
      </div>
    </aside>
  );
};

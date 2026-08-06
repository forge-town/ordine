import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@repo/ui/lib/utils";
import type { PipelineEdgeData } from "@repo/schemas";

type EdgeMappingsSectionProps = {
  edgeData: PipelineEdgeData;
  onChange: (data: PipelineEdgeData) => void;
};

export const EdgeMappingsSection = ({ edgeData, onChange }: EdgeMappingsSectionProps) => {
  const { t } = useTranslation();
  const mappings = edgeData.dataContract?.mappings ?? [];
  const enabledCount = mappings.filter((mapping) => mapping.enabled).length;

  const handleMappingToggle = (mappingIndex: number) => {
    const nextMappings = mappings.map((mapping, index) =>
      index === mappingIndex ? { ...mapping, enabled: !mapping.enabled } : mapping,
    );
    onChange({
      ...edgeData,
      dataContract: { ...edgeData.dataContract, mappings: nextMappings },
    });
  };

  if (mappings.length === 0) {
    return (
      <div className="rounded-xl bg-muted p-3 text-xs text-muted-foreground ring-1 ring-border">
        {t("workspace.canvas.edgeInspector.noMappings")}
      </div>
    );
  }

  return (
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
            aria-pressed={mapping.enabled}
            className={cn(
              "grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl px-2.5 py-2 text-left ring-1 transition-all",
              mapping.enabled
                ? "bg-muted ring-border hover:ring-ring/50"
                : "bg-card opacity-55 ring-border/60 hover:opacity-80",
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
                mapping.enabled ? "bg-foreground" : "bg-muted-foreground/30",
              )}
            >
              <span
                className={cn(
                  "size-3 rounded-full bg-background transition-transform",
                  mapping.enabled && "translate-x-3",
                )}
              />
            </span>
            <span
              className={cn("truncate font-mono text-[11px]", !mapping.enabled && "line-through")}
            >
              {mapping.enabled ? mapping.toInput : t("workspace.canvas.edgeInspector.dropped")}
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
  );
};

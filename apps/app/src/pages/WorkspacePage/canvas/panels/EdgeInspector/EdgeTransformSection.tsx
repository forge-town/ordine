import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import type { PipelineEdgeData } from "@repo/schemas";

type EdgeTransformSectionProps = {
  edgeData: PipelineEdgeData;
  onChange: (data: PipelineEdgeData) => void;
};

const TRANSFORM_OPTIONS = ["trim", "uppercase", "lowercase"] as const;

export const EdgeTransformSection = ({ edgeData, onChange }: EdgeTransformSectionProps) => {
  const { t } = useTranslation();
  const handleAdd = (type: (typeof TRANSFORM_OPTIONS)[number]) =>
    onChange({
      ...edgeData,
      transform: { steps: [...(edgeData.transform?.steps ?? []), { config: {}, type }] },
    });
  const handleClear = () => onChange({ ...edgeData, transform: undefined });

  return (
    <div className="space-y-2 rounded-xl bg-muted/60 px-2.5 py-2 ring-1 ring-border">
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
            onClick={() => handleAdd(type)}
          >
            {type}
          </Button>
        ))}
        <Button
          className="h-7 px-2 text-[11px]"
          size="sm"
          type="button"
          variant="ghost"
          onClick={handleClear}
        >
          {t("workspace.canvas.edgeInspector.clear")}
        </Button>
      </div>
      <div className="text-[11px] text-muted-foreground">
        {(edgeData.transform?.steps ?? []).map((step) => step.type).join(" → ") ||
          t("workspace.canvas.edgeInspector.noTransform")}
      </div>
    </div>
  );
};

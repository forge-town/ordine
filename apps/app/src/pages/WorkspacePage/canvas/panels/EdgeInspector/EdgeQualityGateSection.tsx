import { useTranslation } from "react-i18next";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
import type { PipelineEdgeData } from "@repo/schemas";

type EdgeQualityGateSectionProps = {
  edgeData: PipelineEdgeData;
  onChange: (data: PipelineEdgeData) => void;
};

const ON_FAIL_OPTIONS = ["retry", "skip", "fail"] as const;

export const EdgeQualityGateSection = ({ edgeData, onChange }: EdgeQualityGateSectionProps) => {
  const { t } = useTranslation();

  const handleCriteriaChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const criteria = event.target.value.trim();
    onChange({
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

  const handleMaxRetriesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.valueAsNumber;
    if (!Number.isFinite(value) || !edgeData.qualityGate) {
      return;
    }
    onChange({
      ...edgeData,
      qualityGate: { ...edgeData.qualityGate, maxRetries: Math.max(0, Math.floor(value)) },
    });
  };

  const handleOnFailChange = (value: (typeof ON_FAIL_OPTIONS)[number] | null) => {
    if (!value || !edgeData.qualityGate) {
      return;
    }
    onChange({
      ...edgeData,
      qualityGate: { ...edgeData.qualityGate, onFail: value },
    });
  };

  return (
    <div className="space-y-2 rounded-xl bg-muted/60 px-2.5 py-2 ring-1 ring-border">
      <Label className="text-[11px] font-medium text-muted-foreground" htmlFor="edge-quality">
        {t("workspace.canvas.edgeInspector.qualityGate")}
      </Label>
      <Input
        data-testid="edge-inspector-quality"
        id="edge-quality"
        placeholder={t("workspace.canvas.edgeInspector.qualityPlaceholder")}
        value={edgeData.qualityGate?.criteria ?? ""}
        onChange={handleCriteriaChange}
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
            onChange={handleMaxRetriesChange}
          />
          <Select value={edgeData.qualityGate.onFail} onValueChange={handleOnFailChange}>
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
  );
};

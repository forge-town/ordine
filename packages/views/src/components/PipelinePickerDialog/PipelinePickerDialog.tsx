import type { MouseEvent as ReactMouseEvent } from "react";
import { Clock, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { PipelineData, Routine } from "@repo/schemas";
import { Button } from "@repo/ui/button";

export type PipelinePickerDialogProps = {
  pipelines: PipelineData[];
  routines: Routine[];
  onClose: () => void;
  onPick: (pipeline: PipelineData) => void;
};

export const PipelinePickerDialog = ({
  pipelines,
  routines,
  onClose,
  onPick,
}: PipelinePickerDialogProps) => {
  const { t } = useTranslation();
  const handleContentClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  return (
    <div
      className="absolute inset-0 z-50 grid place-items-center p-6"
      data-testid="pipeline-picker"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-foreground/10 backdrop-blur-[1px]" />
      <div
        className="relative w-[min(380px,calc(100vw_-_2rem))] overflow-hidden rounded-2xl bg-surface shadow-float ring-1 ring-border-strong"
        onClick={handleContentClick}
      >
        <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3">
          <Clock className="size-3.5 text-foreground/75" />
          <span className="flex-1 text-sm font-semibold">{t("jobs.pickPipeline")}</span>
          <Button
            aria-label={t("jobs.closePipelinePicker")}
            size="icon"
            variant="ghost"
            onClick={onClose}
          >
            <X className="size-3.5" />
          </Button>
        </div>
        <div className="max-h-72 overflow-y-auto p-2">
          {pipelines.length === 0 ? (
            <p className="px-2.5 py-4 text-center text-xs text-muted-foreground">
              {t("jobs.noPipelines")}
            </p>
          ) : null}
          {pipelines.map((pipeline) => (
            <button
              key={pipeline.id}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-accent/60"
              data-testid={`pipeline-pick-${pipeline.id}`}
              type="button"
              onClick={() => onPick(pipeline)}
            >
              <span className="min-w-0 flex-1 truncate font-medium">{pipeline.name}</span>
              {(routines.some((routine) => routine.pipelineId === pipeline.id) && (
                <span className="shrink-0 rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {t("jobs.hasRoutine")}
                </span>
              )) ||
                null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

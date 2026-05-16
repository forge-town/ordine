import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { Button } from "@repo/ui/button";
import { FlaskConical, Sparkles } from "lucide-react";
import { useDistillationStudioPageStore } from "./_store";

export const DistillationActionBar = () => {
  const { t } = useTranslation();

  const store = useDistillationStudioPageStore();
  const latestDistillation = useStore(store, (s) => s.latestDistillation);
  const refinementId = useStore(store, (s) => s.refinementId);
  const refinementRounds = useStore(store, (s) => s.refinementRounds);
  const handleRefinementRoundsSelectChange = useStore(
    store,
    (s) => s.handleRefinementRoundsSelectChange,
  );
  const handleStartRefinementButtonClick = useStore(
    store,
    (s) => s.handleStartRefinementButtonClick,
  );
  const handleOptimizePipelineButtonClick = useStore(
    store,
    (s) => s.handleOptimizePipelineButtonClick,
  );

  if (!latestDistillation?.result) {
    return null;
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <div className="flex items-center gap-1.5">
        <select
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          value={refinementRounds}
          onChange={handleRefinementRoundsSelectChange}
        >
          {[1, 2, 3, 5, 8, 10].map((n) => (
            <option key={n} value={n}>
              {n} {t("distillations.refinementRounds")}
            </option>
          ))}
        </select>
        <Button
          disabled={!!refinementId}
          size="sm"
          variant="secondary"
          onClick={handleStartRefinementButtonClick}
        >
          <FlaskConical className="mr-1.5 h-3.5 w-3.5" />
          {t("distillations.startRefinement")}
        </Button>
      </div>
      <Button size="sm" onClick={handleOptimizePipelineButtonClick}>
        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
        {t("distillations.optimizePipeline")}
      </Button>
    </div>
  );
};

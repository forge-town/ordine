import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { Button } from "@repo/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/select";
import { FlaskConical, Sparkles } from "lucide-react";
import { useDistillationStudioPageStore } from "./_store";

const REFINEMENT_ROUND_OPTIONS = [1, 2, 3, 5, 8, 10];

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
        <Select value={String(refinementRounds)} onValueChange={handleRefinementRoundsSelectChange}>
          <SelectTrigger className="h-8 w-32 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {REFINEMENT_ROUND_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} {t("distillations.refinementRounds")}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
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

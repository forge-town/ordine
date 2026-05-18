import { useNavigate } from "@tanstack/react-router";
import { useCustomMutation } from "@refinedev/core";
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
import { type DistillationActionDependencies, useDistillationStudioPageStore } from "./_store";

const REFINEMENT_ROUND_OPTIONS = [1, 2, 3, 5, 8, 10];

export const DistillationActionBar = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { mutateAsync: startRefinement } = useCustomMutation();
  const { mutateAsync: optimizePipeline } = useCustomMutation();

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

  const actionDependencies: DistillationActionDependencies = {
    startRefinement: async (sourceDistillationId, maxRounds) => {
      const result = await startRefinement({
        url: "refinements/start",
        method: "post",
        values: { sourceDistillationId, maxRounds },
      });

      return (result.data as { id: string }).id;
    },
    optimizePipeline: async (distillationId) => {
      const result = await optimizePipeline({
        url: "pipelines/optimizeFromDistillation",
        method: "post",
        values: { distillationId },
      });

      return (result.data as { id: string }).id;
    },
    navigateToPipeline: (pipelineId) => {
      void navigate({ to: "/pipelines/$pipelineId", params: { pipelineId } });
    },
  };

  const handleStartRefinementClick = () => {
    void handleStartRefinementButtonClick(actionDependencies);
  };

  const handleOptimizePipelineClick = () => {
    void handleOptimizePipelineButtonClick(actionDependencies);
  };

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
          onClick={handleStartRefinementClick}
        >
          <FlaskConical className="mr-1.5 h-3.5 w-3.5" />
          {t("distillations.startRefinement")}
        </Button>
      </div>
      <Button size="sm" onClick={handleOptimizePipelineClick}>
        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
        {t("distillations.optimizePipeline")}
      </Button>
    </div>
  );
};

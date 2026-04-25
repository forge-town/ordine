import { useNavigate } from "@tanstack/react-router";
import { useCustomMutation } from "@refinedev/core";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { Button } from "@repo/ui/button";
import { FlaskConical, Loader2, Sparkles } from "lucide-react";
import { useDistillationStudioPageStore } from "./_store";

export const DistillationActionBar = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const store = useDistillationStudioPageStore();
  const latestDistillation = useStore(store, (s) => s.latestDistillation);
  const refinementId = useStore(store, (s) => s.refinementId);
  const refinementRounds = useStore(store, (s) => s.refinementRounds);
  const setRefinementId = useStore(store, (s) => s.handleSetRefinementId);
  const setRefinementRounds = useStore(store, (s) => s.handleSetRefinementRounds);

  const { mutate: optimizePipeline, mutation: optimizeMutation } = useCustomMutation();
  const { mutate: startRefinement, mutation: refinementMutation } = useCustomMutation();
  const isOptimizing = optimizeMutation.isPending;
  const isStartingRefinement = refinementMutation.isPending;

  if (!latestDistillation?.result) {
    return null;
  }

  const handleOptimizePipeline = () => {
    optimizePipeline(
      {
        url: "pipelines/optimizeFromDistillation",
        method: "post",
        values: { distillationId: latestDistillation.id },
      },
      {
        onSuccess: (data) => {
          const pipeline = data.data as { id: string };
          void navigate({
            to: "/pipelines/$pipelineId",
            params: { pipelineId: pipeline.id },
          });
        },
      },
    );
  };

  const handleStartRefinement = () => {
    startRefinement(
      {
        url: "refinements/start",
        method: "post",
        values: {
          sourceDistillationId: latestDistillation.id,
          maxRounds: refinementRounds,
        },
      },
      {
        onSuccess: (data) => {
          const result = data.data as { id: string };
          setRefinementId(result.id);
        },
      },
    );
  };

  return (
    <div className="flex items-center justify-end gap-2">
      <div className="flex items-center gap-1.5">
        <select
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          value={refinementRounds}
          onChange={(e) => setRefinementRounds(Number(e.target.value))}
        >
          {[1, 2, 3, 5, 8, 10].map((n) => (
            <option key={n} value={n}>
              {n} {t("distillations.refinementRounds")}
            </option>
          ))}
        </select>
        <Button
          disabled={isStartingRefinement || !!refinementId}
          onClick={handleStartRefinement}
          size="sm"
          variant="secondary"
        >
          {isStartingRefinement ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <FlaskConical className="mr-1.5 h-3.5 w-3.5" />
          )}
          {isStartingRefinement
            ? t("distillations.refinementRunning")
            : t("distillations.startRefinement")}
        </Button>
      </div>
      <Button disabled={isOptimizing} onClick={handleOptimizePipeline} size="sm">
        {isOptimizing ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
        )}
        {isOptimizing ? t("distillations.optimizing") : t("distillations.optimizePipeline")}
      </Button>
    </div>
  );
};

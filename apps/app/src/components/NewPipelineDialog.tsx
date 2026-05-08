import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useCreate } from "@refinedev/core";
import { useStore } from "zustand";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Play,
  Plus,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@repo/ui/dialog";
import { Button } from "@repo/ui/button";
import { Textarea } from "@repo/ui/textarea";
import { Input } from "@repo/ui/input";
import { Badge } from "@repo/ui/badge";
import { PipelinePreviewGraph } from "@/components/PipelinePreviewGraph";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { trpcClient } from "@/integrations/trpc/client";
import type { PipelineData } from "@repo/pipeline-engine/schemas";
import { useSidebarStore } from "@/store/sidebarStore";

type MatchedOperation = { operationId: string; operationName: string; reason: string };
type UnmatchedStep = { step: string; reason: string };

type DialogPhase =
  | { step: "form" }
  | { step: "analyzing" }
  | {
      step: "analysis";
      matchedOperations: MatchedOperation[];
      unmatchedSteps: UnmatchedStep[];
    }
  | { step: "creating" }
  | { step: "success"; pipelineId: string; pipelineName: string };

export const NewPipelineDialog = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const store = useSidebarStore();
  const open = useStore(store, (s) => s.newPipelineOpen);
  const setOpen = useStore(store, (s) => s.setNewPipelineOpen);
  const { mutateAsync: createPipelineMutate } = useCreate();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [phase, setPhase] = useState<DialogPhase>({ step: "form" });

  const resetForm = () => {
    setName("");
    setDescription("");
    setPhase({ step: "form" });
  };

  const handleOpenChange = (value: boolean) => {
    setOpen(value);
    if (!value) {
      resetForm();
    }
  };

  const handleAnalyze = async () => {
    const trimmedDescription = description.trim();
    const pipelineName = name.trim() || t("pipelines.createNew");

    if (!trimmedDescription) {
      void handleGenerate();

      return;
    }

    setPhase({ step: "analyzing" });

    const analysis = await trpcClient.pipelines.analyzeIntent.mutate({
      name: pipelineName,
      description: trimmedDescription,
    });

    setPhase({
      step: "analysis",
      matchedOperations: analysis.matchedOperations,
      unmatchedSteps: analysis.unmatchedSteps,
    });
  };

  const handleGenerate = async () => {
    const id = `pipeline-${Date.now()}`;
    const now = new Date();
    const trimmedDescription = description.trim();
    const pipelineName = name.trim() || t("pipelines.createNew");

    const currentMatchedOperations =
      phase.step === "analysis" ? phase.matchedOperations : undefined;
    const currentUnmatchedSteps =
      phase.step === "analysis" ? phase.unmatchedSteps : undefined;

    setPhase({ step: "creating" });

    const generated = await (async () => {
      if (!trimmedDescription) {
        return { nodes: [] as PipelineData["nodes"], edges: [] as PipelineData["edges"] };
      }

      return trpcClient.pipelines.generateStructure.mutate({
        name: pipelineName,
        description: trimmedDescription,
        matchedOperations:
          currentMatchedOperations && currentMatchedOperations.length > 0
            ? currentMatchedOperations
            : undefined,
        unmatchedSteps:
          currentUnmatchedSteps && currentUnmatchedSteps.length > 0
            ? currentUnmatchedSteps
            : undefined,
      });
    })();

    const newPipeline: PipelineData = {
      id,
      name: pipelineName,
      description: trimmedDescription,
      tags: [],
      createdAt: now,
      updatedAt: now,
      timeoutMs: null,
      nodes: generated.nodes,
      edges: generated.edges,
    };
    const result = await createPipelineMutate({
      resource: ResourceName.pipelines,
      values: newPipeline,
    });
    const saved = result.data as PipelineData;
    setPhase({ step: "success", pipelineId: saved.id, pipelineName });
  };

  const handleSubmit = () => void handleAnalyze();

  const handleProceedGeneration = () => void handleGenerate();

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(e.target.value);
  };

  const handleCancel = () => handleOpenChange(false);

  const handleBackToForm = () => {
    setPhase({ step: "form" });
  };

  const handleOpenInCanvas = () => {
    if (phase.step !== "success") return;
    setOpen(false);
    resetForm();
    void navigate({ to: "/canvas", search: { id: phase.pipelineId } });
  };

  const handleRunNow = () => {
    if (phase.step !== "success") return;
    const { pipelineId } = phase;
    setOpen(false);
    resetForm();
    void trpcClient.pipelines.run.mutate({ id: pipelineId });
    void navigate({ to: "/canvas", search: { id: pipelineId } });
  };

  const handleCreateAnother = () => {
    resetForm();
  };

  const isLoading = phase.step === "analyzing" || phase.step === "creating";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {phase.step === "success" && (
          <>
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="animate-in zoom-in-50 fade-in duration-300 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 flex flex-col items-center gap-2 text-center">
                <DialogTitle className="text-lg">
                  {t("newPipelineDialog.pipelineReady")}
                </DialogTitle>
                <DialogDescription>
                  {t("newPipelineDialog.pipelineCreatedDescription")}
                </DialogDescription>
                <Badge className="mt-1 font-mono text-xs" variant="secondary">
                  {phase.pipelineId}
                </Badge>
                <p className="text-sm font-medium text-foreground">{phase.pipelineName}</p>
              </div>
            </div>
            <DialogFooter className="animate-in fade-in slide-in-from-bottom-1 duration-500 flex-col gap-2 sm:flex-col">
              <div className="flex w-full gap-2">
                <Button className="flex-1" onClick={handleOpenInCanvas}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {t("newPipelineDialog.openInCanvas")}
                </Button>
                <Button className="flex-1" variant="secondary" onClick={handleRunNow}>
                  <Play className="mr-2 h-4 w-4" />
                  {t("newPipelineDialog.runNow")}
                </Button>
              </div>
              <Button className="w-full" variant="ghost" onClick={handleCreateAnother}>
                <Plus className="mr-2 h-4 w-4" />
                {t("newPipelineDialog.createAnother")}
              </Button>
            </DialogFooter>
          </>
        )}

        {phase.step === "analysis" && (
          <>
            <DialogHeader>
              <DialogTitle>{t("newPipelineDialog.analysisTitle")}</DialogTitle>
              <DialogDescription>{t("newPipelineDialog.analysisDescription")}</DialogDescription>
            </DialogHeader>
            <div className="animate-in fade-in slide-in-from-bottom-1 duration-200 py-2">
              <PipelinePreviewGraph
                matchedOperations={phase.matchedOperations}
                unmatchedSteps={phase.unmatchedSteps}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleBackToForm}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("newPipelineDialog.backToEdit")}
              </Button>
              <Button onClick={handleProceedGeneration}>
                {t("newPipelineDialog.proceedWithGeneration")}
              </Button>
            </DialogFooter>
          </>
        )}

        {(phase.step === "form" || phase.step === "analyzing" || phase.step === "creating") && (
          <>
            <DialogHeader>
              <DialogTitle>{t("nav.newPipeline")}</DialogTitle>
              <DialogDescription>{t("pipelines.newPipelineDescription")}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 py-2">
              <Input
                disabled={isLoading}
                placeholder={t("nav.newPipeline")}
                value={name}
                onChange={handleNameChange}
              />
              <Textarea
                disabled={isLoading}
                placeholder={t("newPipelineDialog.descriptionPlaceholder")}
                rows={3}
                value={description}
                onChange={handleDescriptionChange}
              />
            </div>
            <DialogFooter>
              <Button disabled={isLoading} variant="outline" onClick={handleCancel}>
                {t("common.cancel")}
              </Button>
              <Button disabled={isLoading} onClick={handleSubmit}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {phase.step === "analyzing"
                      ? t("newPipelineDialog.analyzing")
                      : t("common.generating")}
                  </>
                ) : (
                  t("common.create")
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

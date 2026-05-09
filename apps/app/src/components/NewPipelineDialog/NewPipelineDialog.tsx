import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { useForm } from "react-hook-form";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Play,
  Plus,
  AlertCircle,
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
import { Form, FormField, FormItem, FormControl } from "@repo/ui/form";
import { PipelinePreviewGraph } from "@/components/PipelinePreviewGraph";
import { useSidebarStore } from "@/store/sidebarStore";
import type { NewPipelineFormValues } from "@/store/newPipelineDialogSlice";

export const NewPipelineDialog = () => {
  const { t } = useTranslation();
  const store = useSidebarStore();
  const open = useStore(store, (s) => s.newPipelineOpen);
  const phase = useStore(store, (s) => s.newPipelinePhase);
  const formControl = useStore(store, (s) => s.newPipelineFormControl);
  const handleNewPipelineDialogOpenChange = useStore(
    store,
    (s) => s.handleNewPipelineDialogOpenChange
  );
  const handleNewPipelineCreateButtonClick = useStore(
    store,
    (s) => s.handleNewPipelineCreateButtonClick
  );
  const handleNewPipelineProceedButtonClick = useStore(
    store,
    (s) => s.handleNewPipelineProceedButtonClick
  );
  const handleNewPipelineCancelButtonClick = useStore(
    store,
    (s) => s.handleNewPipelineCancelButtonClick
  );
  const handleNewPipelineBackButtonClick = useStore(
    store,
    (s) => s.handleNewPipelineBackButtonClick
  );
  const handleNewPipelineOpenInCanvasButtonClick = useStore(
    store,
    (s) => s.handleNewPipelineOpenInCanvasButtonClick
  );
  const handleNewPipelineRunNowButtonClick = useStore(
    store,
    (s) => s.handleNewPipelineRunNowButtonClick
  );
  const handleNewPipelineCreateAnotherButtonClick = useStore(
    store,
    (s) => s.handleNewPipelineCreateAnotherButtonClick
  );

  const form = useForm<NewPipelineFormValues>({
    formControl: formControl.formControl,
  });

  const isLoading = phase.step === "analyzing" || phase.step === "creating";

  return (
    <Dialog open={open} onOpenChange={handleNewPipelineDialogOpenChange}>
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
                <Button className="flex-1" onClick={handleNewPipelineOpenInCanvasButtonClick}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {t("newPipelineDialog.openInCanvas")}
                </Button>
                <Button
                  className="flex-1"
                  variant="secondary"
                  onClick={handleNewPipelineRunNowButtonClick}
                >
                  <Play className="mr-2 h-4 w-4" />
                  {t("newPipelineDialog.runNow")}
                </Button>
              </div>
              <Button
                className="w-full"
                variant="ghost"
                onClick={handleNewPipelineCreateAnotherButtonClick}
              >
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
              <Button variant="outline" onClick={handleNewPipelineBackButtonClick}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("newPipelineDialog.backToEdit")}
              </Button>
              <Button onClick={handleNewPipelineProceedButtonClick}>
                {t("newPipelineDialog.proceedWithGeneration")}
              </Button>
            </DialogFooter>
          </>
        )}

        {(phase.step === "form" ||
          phase.step === "analyzing" ||
          phase.step === "creating" ||
          phase.step === "error") && (
          <>
            <DialogHeader>
              <DialogTitle>{t("nav.newPipeline")}</DialogTitle>
              <DialogDescription>{t("pipelines.newPipelineDescription")}</DialogDescription>
            </DialogHeader>
            {phase.step === "error" && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{phase.message}</span>
              </div>
            )}
            <Form {...form}>
              <div className="flex flex-col gap-3 py-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input disabled={isLoading} placeholder={t("nav.newPipeline")} {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea
                          disabled={isLoading}
                          placeholder={t("newPipelineDialog.descriptionPlaceholder")}
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </Form>
            <DialogFooter>
              <Button
                disabled={isLoading}
                variant="outline"
                onClick={handleNewPipelineCancelButtonClick}
              >
                {t("common.cancel")}
              </Button>
              <Button disabled={isLoading} onClick={handleNewPipelineCreateButtonClick}>
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

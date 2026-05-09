import { createFormControl } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import type { SidebarStoreSlice } from "./sidebarStore";
import { dataProvider, ResourceName } from "@/integrations/refine/dataProvider";
import i18n from "@/lib/i18n";
import { router } from "@/router";
import type { PipelineData } from "@repo/pipeline-engine/schemas";

type MatchedOperation = { operationId: string; operationName: string; reason: string };
type UnmatchedStep = { step: string; reason: string };

export type NewPipelineDialogPhase =
  | { step: "form" }
  | { step: "analyzing" }
  | {
      step: "analysis";
      matchedOperations: MatchedOperation[];
      unmatchedSteps: UnmatchedStep[];
    }
  | { step: "creating" }
  | { step: "error"; message: string }
  | { step: "success"; pipelineId: string; pipelineName: string };

export const newPipelineFormSchema = z.object({
  name: z.string(),
  description: z.string(),
});

export type NewPipelineFormValues = z.infer<typeof newPipelineFormSchema>;

type FormControlReturn = ReturnType<typeof createFormControl<NewPipelineFormValues>>;

export interface NewPipelineDialogSlice {
  newPipelinePhase: NewPipelineDialogPhase;
  newPipelineFormControl: FormControlReturn;
  handleNewPipelineDialogOpenChange: (open: boolean) => void;
  handleNewPipelineCreateButtonClick: () => void;
  handleNewPipelineProceedButtonClick: () => void;
  handleNewPipelineCancelButtonClick: () => void;
  handleNewPipelineBackButtonClick: () => void;
  handleNewPipelineOpenInCanvasButtonClick: () => void;
  handleNewPipelineRunNowButtonClick: () => void;
  handleNewPipelineCreateAnotherButtonClick: () => void;
}

export const createNewPipelineDialogSlice: SidebarStoreSlice<NewPipelineDialogSlice> = (
  set,
  get
) => {
  const formControl = createFormControl<NewPipelineFormValues>({
    defaultValues: { name: "", description: "" },
    resolver: zodResolver(newPipelineFormSchema),
  });

  const reset = () => {
    formControl.reset();
    set({ newPipelinePhase: { step: "form" } });
  };

  const getDefaultName = () => i18n.t("pipelines.createNew");

  const analyze = async () => {
    const { name, description } = formControl.getValues();
    const trimmedDescription = description.trim();
    const pipelineName = name.trim() || getDefaultName();

    if (!trimmedDescription) {
      void generate();

      return;
    }

    set({ newPipelinePhase: { step: "analyzing" } });

    const { data: analysis } = (await dataProvider.custom!({
      url: "pipelines/analyzeIntent",
      method: "post",
      payload: { name: pipelineName, description: trimmedDescription },
    })) as { data: { matchedOperations: MatchedOperation[]; unmatchedSteps: UnmatchedStep[] } };

    set({
      newPipelinePhase: {
        step: "analysis",
        matchedOperations: analysis.matchedOperations,
        unmatchedSteps: analysis.unmatchedSteps,
      },
    });
  };

  const generate = async () => {
    const { name, description } = formControl.getValues();
    const id = `pipeline-${Date.now()}`;
    const now = new Date();
    const trimmedDescription = description.trim();
    const pipelineName = name.trim() || getDefaultName();

    const phase = get().newPipelinePhase;
    const currentMatchedOperations =
      phase.step === "analysis" ? phase.matchedOperations : undefined;
    const currentUnmatchedSteps = phase.step === "analysis" ? phase.unmatchedSteps : undefined;

    set({ newPipelinePhase: { step: "creating" } });

    type GenerateResult =
      | {
          nodes: PipelineData["nodes"];
          edges: PipelineData["edges"];
          pendingOperations?: Array<Record<string, unknown>>;
        }
      | { error: string };

    const generated = await (async (): Promise<GenerateResult> => {
      if (!trimmedDescription) {
        return {
          nodes: [] as PipelineData["nodes"],
          edges: [] as PipelineData["edges"],
        };
      }

      const { data } = await dataProvider.custom!({
        url: "pipelines/generateStructure",
        method: "post",
        payload: {
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
        },
      });

      return data as GenerateResult;
    })();

    if ("error" in generated) {
      set({ newPipelinePhase: { step: "error", message: generated.error } });

      return;
    }

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

    const result = await dataProvider.create({
      resource: ResourceName.pipelines,
      variables: {
        ...newPipeline,
        ...(generated.pendingOperations ? { pendingOperations: generated.pendingOperations } : {}),
      },
    });
    const saved = result.data as PipelineData;
    set({ newPipelinePhase: { step: "success", pipelineId: saved.id, pipelineName } });
  };

  return {
    newPipelinePhase: { step: "form" },
    newPipelineFormControl: formControl,
    handleNewPipelineDialogOpenChange: (open) => {
      set({ newPipelineOpen: open });
      if (!open) {
        reset();
      }
    },
    handleNewPipelineCreateButtonClick: () => void analyze(),
    handleNewPipelineProceedButtonClick: () => void generate(),
    handleNewPipelineCancelButtonClick: () => {
      set({ newPipelineOpen: false });
      reset();
    },
    handleNewPipelineBackButtonClick: () => {
      set({ newPipelinePhase: { step: "form" } });
    },
    handleNewPipelineOpenInCanvasButtonClick: () => {
      const phase = get().newPipelinePhase;
      if (phase.step !== "success") return;
      set({ newPipelineOpen: false });
      reset();
      void router.navigate({ to: "/canvas", search: { id: phase.pipelineId } });
    },
    handleNewPipelineRunNowButtonClick: () => {
      const phase = get().newPipelinePhase;
      if (phase.step !== "success") return;
      const { pipelineId } = phase;
      set({ newPipelineOpen: false });
      reset();
      void dataProvider.custom!({
        url: "pipelines/run",
        method: "post",
        payload: { id: pipelineId },
      });
      void router.navigate({ to: "/canvas", search: { id: pipelineId } });
    },
    handleNewPipelineCreateAnotherButtonClick: () => {
      reset();
    },
  };
};

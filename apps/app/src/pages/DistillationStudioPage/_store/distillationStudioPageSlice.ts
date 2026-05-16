import type { ChangeEvent } from "react";
import type { StateCreator } from "zustand";
import { createFormControl } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import {
  AgentRuntimeSchema,
  DistillationModeSchema,
  DistillationSourceTypeSchema,
  type Distillation,
  type DistillationSourceType,
} from "@repo/schemas";
import { dataProvider, ResourceName } from "@/integrations/refine/dataProvider";
import { router } from "@/router";

type SubmissionMode = "draft" | "run";

export const distillationFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  summary: z.string(),
  sourceType: DistillationSourceTypeSchema,
  sourceId: z.string(),
  sourceLabel: z.string(),
  mode: DistillationModeSchema,
  objective: z.string(),
  agent: AgentRuntimeSchema.optional(),
  model: z.string(),
  systemPrompt: z.string(),
});

export type DistillationFormValues = z.infer<typeof distillationFormSchema>;

export interface DistillationLoadContext {
  distillationId: string;
  fallbackTitle: string;
  searchSourceType?: DistillationSourceType;
  searchSourceId?: string;
  searchSourceLabel?: string;
  searchMode?: DistillationFormValues["mode"];
}

type DistillationFormControl = ReturnType<typeof createFormControl<DistillationFormValues>>;

const emptyFormValues = (
  fallbackTitle: string,
  searchSourceType: DistillationSourceType | undefined,
  searchSourceId: string | undefined,
  searchSourceLabel: string | undefined,
  searchMode: DistillationFormValues["mode"] | undefined,
): DistillationFormValues => ({
  title: fallbackTitle,
  summary: "",
  sourceType: searchSourceType ?? "manual",
  sourceId: searchSourceId ?? "",
  sourceLabel: searchSourceLabel ?? "",
  mode: searchMode ?? "pipeline",
  objective: "",
  agent: undefined,
  model: "",
  systemPrompt: "",
});

const distillationToFormValues = (
  distillation: Distillation,
): DistillationFormValues => ({
  title: distillation.title,
  summary: distillation.summary,
  sourceType: distillation.sourceType,
  sourceId: distillation.sourceId ?? "",
  sourceLabel: distillation.sourceLabel,
  mode: distillation.mode,
  objective: distillation.config.objective ?? "",
  agent: distillation.config.agent,
  model: distillation.config.model ?? "",
  systemPrompt: distillation.config.systemPrompt ?? "",
});

const buildDistillationPayload = (values: DistillationFormValues) => ({
  title: values.title.trim(),
  summary: values.summary.trim(),
  sourceType: values.sourceType,
  sourceId: values.sourceId.trim() || null,
  sourceLabel: values.sourceLabel.trim(),
  mode: values.mode,
  config: {
    objective: values.objective.trim(),
    ...(values.agent ? { agent: values.agent } : {}),
    ...(values.model.trim() ? { model: values.model.trim() } : {}),
    ...(values.systemPrompt.trim() ? { systemPrompt: values.systemPrompt.trim() } : {}),
  },
});

export interface DistillationStudioPageSlice {
  latestDistillation: Distillation | null;
  submissionMode: SubmissionMode | null;
  refinementId: string | null;
  refinementRounds: number;
  currentSourceType: DistillationSourceType;
  currentSourceId: string;
  distillationFormControl: DistillationFormControl;

  handleRefinementRoundsSelectChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  handleLoadDistillation: (context: DistillationLoadContext) => Promise<void>;
  handleSaveDraftButtonClick: (existingDistillationId: string) => Promise<void>;
  handleRunButtonClick: (existingDistillationId: string) => Promise<void>;
  handleStartRefinementButtonClick: () => Promise<void>;
  handleOptimizePipelineButtonClick: () => Promise<void>;
}

export const createDistillationStudioPageSlice: StateCreator<DistillationStudioPageSlice> = (
  set,
  get,
) => {
  const distillationFormControl = createFormControl<DistillationFormValues>({
    defaultValues: emptyFormValues("", undefined, undefined, undefined, undefined),
    resolver: zodResolver(distillationFormSchema),
  });

  distillationFormControl.watch((values) => {
    const sourceType = (values.sourceType ?? "manual") as DistillationSourceType;
    const sourceId = (values.sourceId ?? "").trim();
    const state = get();
    if (state.currentSourceType !== sourceType) {
      set({ currentSourceType: sourceType });
    }
    if (state.currentSourceId !== sourceId) {
      set({ currentSourceId: sourceId });
    }
  });

  const persistDistillation = async (
    values: DistillationFormValues,
    mode: SubmissionMode,
    existingDistillationId: string,
  ): Promise<Distillation> => {
    const payload = buildDistillationPayload(values);

    if (existingDistillationId) {
      const updated = await dataProvider.update({
        resource: ResourceName.distillations,
        id: existingDistillationId,
        variables:
          mode === "run"
            ? {
                ...payload,
                status: "draft",
                inputSnapshot: null,
                result: null,
              }
            : payload,
      });

      return updated.data as Distillation;
    }

    const created = await dataProvider.create({
      resource: ResourceName.distillations,
      variables: {
        id: crypto.randomUUID(),
        ...payload,
        status: "draft",
        inputSnapshot: null,
        result: null,
      },
    });

    return created.data as Distillation;
  };

  return {
    latestDistillation: null,
    submissionMode: null,
    refinementId: null,
    refinementRounds: 3,
    currentSourceType: "manual",
    currentSourceId: "",
    distillationFormControl,

    handleRefinementRoundsSelectChange: (event) =>
      set({ refinementRounds: Number(event.target.value) }),

    handleLoadDistillation: async (context) => {
      const fallback = emptyFormValues(
        context.fallbackTitle,
        context.searchSourceType,
        context.searchSourceId,
        context.searchSourceLabel,
        context.searchMode,
      );

      if (!context.distillationId) {
        distillationFormControl.reset(fallback);
        set({ latestDistillation: null });

        return;
      }

      const result = await dataProvider.getOne<Distillation>({
        resource: ResourceName.distillations,
        id: context.distillationId,
      });
      const distillation = result.data;
      if (distillation) {
        distillationFormControl.reset(distillationToFormValues(distillation));
        set({ latestDistillation: distillation });
      } else {
        distillationFormControl.reset(fallback);
        set({ latestDistillation: null });
      }
    },

    handleSaveDraftButtonClick: async (existingDistillationId) => {
      set({ submissionMode: "draft" });
      await new Promise<void>((resolve) => {
        void distillationFormControl
          .handleSubmit(async (values) => {
            const draft = await persistDistillation(values, "draft", existingDistillationId);
            set({ latestDistillation: draft });
            resolve();
          }, () => resolve())();
      });
    },

    handleRunButtonClick: async (existingDistillationId) => {
      set({ submissionMode: "run" });
      await new Promise<void>((resolve) => {
        void distillationFormControl
          .handleSubmit(async (values) => {
            const draft = await persistDistillation(values, "run", existingDistillationId);
            const executed = await dataProvider.custom!<Distillation>({
              url: "distillations/run",
              method: "post",
              payload: { id: draft.id },
            });
            if (executed?.data) {
              set({ latestDistillation: executed.data });
            }
            resolve();
          }, () => resolve())();
      });
    },

    handleStartRefinementButtonClick: async () => {
      const { latestDistillation, refinementRounds } = get();
      if (!latestDistillation?.result) return;
      const result = await dataProvider.custom!<{ id: string }>({
        url: "refinements/start",
        method: "post",
        payload: {
          sourceDistillationId: latestDistillation.id,
          maxRounds: refinementRounds,
        },
      });
      set({ refinementId: result.data.id });
    },

    handleOptimizePipelineButtonClick: async () => {
      const { latestDistillation } = get();
      if (!latestDistillation?.result) return;
      const result = await dataProvider.custom!<{ id: string }>({
        url: "pipelines/optimizeFromDistillation",
        method: "post",
        payload: { distillationId: latestDistillation.id },
      });
      const pipelineId = result.data.id;
      void router.navigate({
        to: "/pipelines/$pipelineId",
        params: { pipelineId },
      });
    },
  };
};

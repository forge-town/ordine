import type { StateCreator } from "zustand";
import { createFormControl } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { ResultAsync, okAsync } from "neverthrow";
import {
  AgentRuntimeSchema,
  DistillationModeSchema,
  DistillationSourceTypeSchema,
  type Distillation,
  type DistillationSourceType,
} from "@repo/schemas";

export type SubmissionMode = "draft" | "run";

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

export const emptyFormValues = (
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

export const distillationToFormValues = (distillation: Distillation): DistillationFormValues => ({
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

export const buildDistillationPayload = (values: DistillationFormValues) => ({
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

export interface PersistDistillationInput {
  values: DistillationFormValues;
  mode: SubmissionMode;
  existingDistillationId: string;
}

export interface DistillationSubmitDependencies {
  persistDistillation: (input: PersistDistillationInput) => Promise<Distillation>;
  runDistillation: (distillationId: string) => Promise<Distillation | null>;
}

export interface DistillationActionDependencies {
  startRefinement: (sourceDistillationId: string, maxRounds: number) => Promise<string>;
  optimizePipeline: (distillationId: string) => Promise<string>;
  navigateToPipeline: (pipelineId: string) => void;
}

export interface DistillationStudioPageSlice {
  latestDistillation: Distillation | null;
  submissionMode: SubmissionMode | null;
  refinementId: string | null;
  refinementRounds: number;
  currentSourceType: DistillationSourceType;
  currentSourceId: string;
  distillationFormControl: DistillationFormControl;

  handleRefinementRoundsSelectChange: (value: string | null) => void;
  handleLoadDistillation: (
    context: DistillationLoadContext,
    existingDistillation: Distillation | null,
  ) => void;
  handleSaveDraftButtonClick: (
    existingDistillationId: string,
    dependencies: DistillationSubmitDependencies,
  ) => Promise<void>;
  handleRunButtonClick: (
    existingDistillationId: string,
    dependencies: DistillationSubmitDependencies,
  ) => Promise<void>;
  handleStartRefinementButtonClick: (dependencies: DistillationActionDependencies) => Promise<void>;
  handleOptimizePipelineButtonClick: (
    dependencies: DistillationActionDependencies,
  ) => Promise<void>;
}

const toError = (cause: unknown) => (cause instanceof Error ? cause : new Error(String(cause)));

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

  const submitDistillation = (
    mode: SubmissionMode,
    existingDistillationId: string,
    dependencies: DistillationSubmitDependencies,
  ): Promise<void> =>
    new Promise((resolve) => {
      const finish = () => {
        set({ submissionMode: null });
        resolve();
      };

      void distillationFormControl.handleSubmit(
        (values) => {
          void ResultAsync.fromPromise(
            dependencies.persistDistillation({ values, mode, existingDistillationId }),
            toError,
          )
            .andThen((draft) => {
              set({ latestDistillation: draft });
              if (mode === "draft") {
                return okAsync<Distillation, Error>(draft);
              }

              return ResultAsync.fromPromise(dependencies.runDistillation(draft.id), toError).map(
                (executed) => executed ?? draft,
              );
            })
            .match(
              (distillation) => {
                set({ latestDistillation: distillation });
                finish();
              },
              () => finish(),
            );
        },
        () => finish(),
      )();
    });

  return {
    latestDistillation: null,
    submissionMode: null,
    refinementId: null,
    refinementRounds: 3,
    currentSourceType: "manual",
    currentSourceId: "",
    distillationFormControl,

    handleRefinementRoundsSelectChange: (value) => {
      if (value !== null) set({ refinementRounds: Number(value) });
    },

    handleLoadDistillation: (context, existingDistillation) => {
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

      if (existingDistillation) {
        distillationFormControl.reset(distillationToFormValues(existingDistillation));
        set({ latestDistillation: existingDistillation });
      } else {
        distillationFormControl.reset(fallback);
        set({ latestDistillation: null });
      }
    },

    handleSaveDraftButtonClick: async (existingDistillationId, dependencies) => {
      set({ submissionMode: "draft" });
      await submitDistillation("draft", existingDistillationId, dependencies);
    },

    handleRunButtonClick: async (existingDistillationId, dependencies) => {
      set({ submissionMode: "run" });
      await submitDistillation("run", existingDistillationId, dependencies);
    },

    handleStartRefinementButtonClick: async (dependencies) => {
      const { latestDistillation, refinementRounds } = get();
      if (!latestDistillation?.result) return;
      await ResultAsync.fromPromise(
        dependencies.startRefinement(latestDistillation.id, refinementRounds),
        toError,
      ).match(
        (refinementId) => set({ refinementId }),
        () => undefined,
      );
    },

    handleOptimizePipelineButtonClick: async (dependencies) => {
      const { latestDistillation } = get();
      if (!latestDistillation?.result) return;
      await ResultAsync.fromPromise(
        dependencies.optimizePipeline(latestDistillation.id),
        toError,
      ).match(
        (pipelineId) => dependencies.navigateToPipeline(pipelineId),
        () => undefined,
      );
    },
  };
};

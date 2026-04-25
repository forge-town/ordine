import type { StateCreator } from "zustand";
import type { Distillation, DistillationSourceType } from "@repo/schemas";

type SubmissionMode = "draft" | "run";

export interface DistillationStudioPageSlice {
  latestDistillation: Distillation | null;
  submissionMode: SubmissionMode | null;
  refinementId: string | null;
  refinementRounds: number;
  currentSourceType: DistillationSourceType;
  currentSourceId: string;

  handleSetLatestDistillation: (distillation: Distillation | null) => void;
  handleSetSubmissionMode: (mode: SubmissionMode | null) => void;
  handleSetRefinementId: (id: string | null) => void;
  handleSetRefinementRounds: (rounds: number) => void;
  handleSetCurrentSourceType: (sourceType: DistillationSourceType) => void;
  handleSetCurrentSourceId: (sourceId: string) => void;
}

export const createDistillationStudioPageSlice: StateCreator<DistillationStudioPageSlice> = (
  set,
) => ({
  latestDistillation: null,
  submissionMode: null,
  refinementId: null,
  refinementRounds: 3,
  currentSourceType: "manual",
  currentSourceId: "",

  handleSetLatestDistillation: (distillation) => set({ latestDistillation: distillation }),
  handleSetSubmissionMode: (mode) => set({ submissionMode: mode }),
  handleSetRefinementId: (id) => set({ refinementId: id }),
  handleSetRefinementRounds: (rounds) => set({ refinementRounds: rounds }),
  handleSetCurrentSourceType: (sourceType) => set({ currentSourceType: sourceType }),
  handleSetCurrentSourceId: (sourceId) => set({ currentSourceId: sourceId }),
});

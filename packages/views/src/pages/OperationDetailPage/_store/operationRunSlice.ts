import type { ChangeEvent } from "react";
import type { StateCreator } from "zustand";
import { ResultAsync } from "neverthrow";

export type OperationRunStatus = "idle" | "running" | "done" | "failed";

interface StartOperationRunInput {
  operationId: string;
  inputPath?: string;
  inputContent?: string;
}

type StartOperationRun = (input: StartOperationRunInput) => Promise<string>;

export interface OperationRunSlice {
  runJobId: string | null;
  runStatus: OperationRunStatus;
  runInputPath: string;
  runInputContent: string;
  isRunPanelOpen: boolean;

  handleRunInputPathInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  handleRunInputPathBrowserSelect: (path: string) => void;
  handleRunInputContentTextareaChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  handleStartRunButtonClick: (operationId: string, startRun: StartOperationRun) => void;
  handleOpenRunPanelButtonClick: () => void;
  handleCloseRunPanelButtonClick: () => void;
}

export const createOperationRunSlice: StateCreator<OperationRunSlice> = (set, get) => ({
  runJobId: null,
  runStatus: "idle",
  runInputPath: "",
  runInputContent: "",
  isRunPanelOpen: false,

  handleRunInputPathInputChange: (event) => set({ runInputPath: event.target.value }),
  handleRunInputPathBrowserSelect: (path) => set({ runInputPath: path }),
  handleRunInputContentTextareaChange: (event) => set({ runInputContent: event.target.value }),

  handleStartRunButtonClick: (operationId, startRun) => {
    const { runInputPath, runInputContent } = get();
    set({ runStatus: "running", isRunPanelOpen: true });

    void ResultAsync.fromPromise(
      startRun({
        operationId,
        inputPath: runInputPath || undefined,
        inputContent: runInputContent || undefined,
      }),
      () => new Error("Failed to start operation run"),
    )
      .map((jobId) => {
        set({ runJobId: jobId });
      })
      .mapErr(() => {
        set({ runStatus: "failed", runJobId: null });
      });
  },

  handleOpenRunPanelButtonClick: () => set({ isRunPanelOpen: true }),
  handleCloseRunPanelButtonClick: () => set({ isRunPanelOpen: false }),
});

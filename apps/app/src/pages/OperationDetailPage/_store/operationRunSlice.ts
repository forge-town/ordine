import type { ChangeEvent } from "react";
import type { StateCreator } from "zustand";
import { ResultAsync } from "neverthrow";
import { dataProvider } from "@/integrations/refine/dataProvider";

export type OperationRunStatus = "idle" | "running" | "done" | "failed";

export interface OperationRunSlice {
  runJobId: string | null;
  runStatus: OperationRunStatus;
  runInputPath: string;
  runInputContent: string;
  isRunPanelOpen: boolean;

  handleRunInputPathInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  handleRunInputPathBrowserSelect: (path: string) => void;
  handleRunInputContentTextareaChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  handleStartRunButtonClick: (operationId: string) => void;
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

  handleStartRunButtonClick: (operationId) => {
    const { runInputPath, runInputContent } = get();
    set({ runStatus: "running", isRunPanelOpen: true });

    void ResultAsync.fromPromise(
      dataProvider.custom!<{ jobId: string }>({
        url: "operations/run",
        method: "post",
        payload: {
          operationId,
          inputPath: runInputPath || undefined,
          inputContent: runInputContent || undefined,
        },
      }),
      () => new Error("Failed to start operation run"),
    )
      .map((response) => {
        set({ runJobId: response.data.jobId });
      })
      .mapErr(() => {
        set({ runStatus: "failed", runJobId: null });
      });
  },

  handleOpenRunPanelButtonClick: () => set({ isRunPanelOpen: true }),
  handleCloseRunPanelButtonClick: () => set({ isRunPanelOpen: false }),
});

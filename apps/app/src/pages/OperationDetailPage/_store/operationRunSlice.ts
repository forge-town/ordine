import type { StateCreator } from "zustand";
import type { AgentRuntime } from "@repo/schemas";
import { ResultAsync } from "neverthrow";
import { dataProvider } from "@/integrations/refine/dataProvider";

export type OperationRunStatus = "idle" | "running" | "done" | "failed";

export interface OperationRunSlice {
  runJobId: string | null;
  runStatus: OperationRunStatus;
  runInputPath: string;
  runInputContent: string;
  runAgentOverride: AgentRuntime | undefined;
  isRunPanelOpen: boolean;

  handleSetRunInputPath: (path: string) => void;
  handleSetRunInputContent: (content: string) => void;
  handleSetRunAgentOverride: (agent: AgentRuntime | undefined) => void;
  handleStartRun: (operationId: string) => void;
  handleOpenRunPanel: () => void;
  handleCloseRunPanel: () => void;
}

export const createOperationRunSlice: StateCreator<OperationRunSlice> = (set, get) => ({
  runJobId: null,
  runStatus: "idle",
  runInputPath: "",
  runInputContent: "",
  runAgentOverride: undefined,
  isRunPanelOpen: false,

  handleSetRunInputPath: (path) => set({ runInputPath: path }),
  handleSetRunInputContent: (content) => set({ runInputContent: content }),
  handleSetRunAgentOverride: (agent) => set({ runAgentOverride: agent }),

  handleStartRun: (operationId) => {
    const { runInputPath, runInputContent, runAgentOverride } = get();
    set({ runStatus: "running", isRunPanelOpen: true });

    void ResultAsync.fromPromise(
      dataProvider.custom!<{ jobId: string }>({
        url: "operations/run",
        method: "post",
        payload: {
          operationId,
          inputPath: runInputPath || undefined,
          inputContent: runInputContent || undefined,
          agentOverride: runAgentOverride,
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

  handleOpenRunPanel: () => set({ isRunPanelOpen: true }),
  handleCloseRunPanel: () => set({ isRunPanelOpen: false }),
});

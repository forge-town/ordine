import { useCallback, useState } from "react";
import { useCreate, useDataProvider } from "@refinedev/core";
import { useStore } from "zustand";
import { ResultAsync } from "neverthrow";
import {
  RunRequestInputSchema,
  RunRequestReceiptSchema,
  type PipelineDefinition,
  type ExecutionJob,
  type ExecutionInputAsset,
  type ExecutionError,
  type RunRequestReceipt,
} from "@repo/schemas";
import { createExecutionWorkspaceStore } from "../ExecutionWorkspacePage/_store";
import { terminalStates } from "../ExecutionWorkspacePage/useJobData";
import { parsePublishedPipelineInputs } from "./publishedPipelineInputs";
import { canvasRequestStatus } from "./canvasAuthoringState";

export const usePublishedPipelineRun = (pipeline: PipelineDefinition) => {
  const getDataProvider = useDataProvider();
  const provider = getDataProvider("execution");
  const [store] = useState(() =>
    createExecutionWorkspaceStore(
      pipeline.id,
      `canonical-canvas:${provider.getApiUrl()}|${pipeline.id}`,
    ),
  );
  const state = useStore(store);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [job, setJob] = useState<ExecutionJob | null>(null);
  const { mutateAsync } = useCreate<RunRequestReceipt>({ mutationOptions: { retry: false } });
  const receipt = state.submission.receipt;
  const canReset =
    ["invalid", "rejected", "expired"].includes(state.submission.phase) ||
    (receipt?.state === "accepted" &&
      job?.id === receipt.jobId &&
      terminalStates.includes(job.state));
  const locked = state.pendingAction !== null || state.submission.phase !== "idle";
  const onReceipt = useCallback(
    (value: RunRequestReceipt) => store.getState().acceptReceipt(value),
    [store],
  );
  const onJob = useCallback((value: ExecutionJob) => setJob(value), []);
  const reset = () => {
    if (canReset) {
      store.getState().resetRequest();
      setJob(null);
    }
  };
  const setInputBusy = (busy: boolean) =>
    store.getState().patch({ pendingAction: busy ? "导入输入文件" : null });
  const submit = async () => {
    if (store.getState().pendingAction || store.getState().submission.phase !== "idle") return;
    store.getState().patch({ pendingAction: "校验输入", error: null });
    const result = await ResultAsync.fromPromise(
      Promise.resolve().then(async () => {
        const inputs = await parsePublishedPipelineInputs(
          pipeline.graph.inputs,
          drafts,
          async (artifactId) =>
            ResultAsync.fromPromise(
              provider.getOne<ExecutionInputAsset>({ resource: "artifacts", id: artifactId }),
              (): ExecutionError => ({
                code: "INPUT_ARTIFACT_UNAVAILABLE",
                message: "无法读取输入文件，请检查引用或重新导入。",
                retryable: false,
                stage: "validation",
              }),
            ).map((response) => response.data),
        );
        const request = RunRequestInputSchema.parse({
          apiVersion: 2,
          requestId: crypto.randomUUID(),
          pipelineId: pipeline.id,
          expectedRevision: pipeline.revision,
          inputs,
        });
        if (!store.getState().startRequest(request)) return;
        store.getState().patch({ pendingAction: "提交运行请求" });
        const response = await mutateAsync({
          dataProviderName: "execution",
          resource: "run-requests",
          values: request,
        });
        store.getState().acceptReceipt(RunRequestReceiptSchema.parse(response.data));
      }),
      (error) => ({
        message: error instanceof Error ? error.message : "运行请求失败，请查询原请求。",
        statusCode: canvasRequestStatus(error),
      }),
    );
    store.getState().patch({ pendingAction: null });
    if (result.isErr()) {
      if (store.getState().submission.phase === "submitting")
        store
          .getState()
          .failRequest(
            result.error.message,
            result.error.statusCode !== undefined &&
              result.error.statusCode >= 400 &&
              result.error.statusCode < 500,
          );
      store.getState().patch({ error: result.error.message });
    }
  };

  return {
    state,
    drafts,
    setDrafts,
    locked,
    canReset,
    reset,
    submit,
    onReceipt,
    onJob,
    setInputBusy,
  };
};

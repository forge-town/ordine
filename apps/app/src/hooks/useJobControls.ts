import { useState } from "react";
import { ResultAsync } from "neverthrow";
import { dataProvider } from "@/integrations/refine/dataProvider";
import { toastStore } from "@/store/toastStore";

/**
 * Job 控制调用的唯一封装（G1-02）。
 * 此前 JobsTable / JobDetailDrawer / TopPill / CheckpointDialog 各自手写
 * dataProvider.custom + ResultAsync + 错误 toast 三件套，语义已开始漂移。
 * 成功侧文案/副作用各处不同，由调用方在 onSuccess 中处理；失败侧统一 error toast。
 */

export type JobControlRequest =
  | { action: "cancel" | "pause" | "resume"; jobId: string }
  | { action: "run"; pipelineId: string };

export type RunStartResponse = {
  jobId: string;
};

export type JobControlHandlers<T> = {
  /** 失败 toast 标题（必填，强制调用方给出本地化文案）。 */
  errorTitle: string;
  onSuccess?: (data: T) => void;
  /** 标记 pending 的键；默认 jobId / pipelineId。 */
  pendingKey?: string;
};

export const useJobControls = () => {
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const control = <T = unknown>(request: JobControlRequest, handlers: JobControlHandlers<T>) => {
    const key =
      handlers.pendingKey ?? (request.action === "run" ? request.pipelineId : request.jobId);
    setPendingKey(key);
    void ResultAsync.fromPromise(
      request.action === "run"
        ? dataProvider.custom!({
            method: "post",
            payload: { id: request.pipelineId },
            url: "pipelines/run",
          })
        : dataProvider.custom!({
            method: "post",
            payload: { jobId: request.jobId },
            url: `jobs/${request.action}`,
          }),
      () => handlers.errorTitle,
    ).match(
      (response) => {
        setPendingKey(null);
        handlers.onSuccess?.(response.data as T);
      },
      (error) => {
        setPendingKey(null);
        toastStore.getState().addToast({ title: error, type: "error" });
      },
    );
  };

  return { control, pendingKey };
};

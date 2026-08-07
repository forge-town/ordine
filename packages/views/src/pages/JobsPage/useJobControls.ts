import { useState } from "react";
import { useCustomMutation } from "@refinedev/core";
import { ResultAsync } from "neverthrow";
import { toastStore } from "../../store/toastStore";

export type JobControlRequest =
  | { action: "cancel" | "pause" | "resume"; jobId: string }
  | { action: "run"; pipelineId: string };

export type JobControlHandlers<T> = {
  errorTitle: string;
  onSuccess?: (data: T) => void;
  pendingKey?: string;
};

export const useJobControls = () => {
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const { mutateAsync } = useCustomMutation();

  const control = <T = unknown>(request: JobControlRequest, handlers: JobControlHandlers<T>) => {
    const key =
      handlers.pendingKey ?? (request.action === "run" ? request.pipelineId : request.jobId);
    const url = request.action === "run" ? "pipelines/run" : `jobs/${request.action}`;
    const values =
      request.action === "run" ? { id: request.pipelineId } : { jobId: request.jobId };
    setPendingKey(key);

    void ResultAsync.fromPromise(
      mutateAsync({ method: "post", url, values }),
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

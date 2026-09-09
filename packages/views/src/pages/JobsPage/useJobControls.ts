import { useRef, useState } from "react";
import { useCreate } from "@refinedev/core";
import type { ExecutionJob } from "@repo/schemas";
import { ResultAsync } from "neverthrow";
import { toastStore } from "../../store/toastStore";

export type JobControlRequest = { action: "cancel" | "pause" | "resume"; jobId: string };

export type JobControlHandlers<T> = {
  errorTitle: string;
  onSuccess?: (data: T) => void;
  pendingKey?: string;
};

export const useJobControls = () => {
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const busy = useRef(false);
  const { mutateAsync } = useCreate<ExecutionJob>({ mutationOptions: { retry: false } });

  const control = <T = unknown>(request: JobControlRequest, handlers: JobControlHandlers<T>) => {
    if (busy.current) return;
    busy.current = true;
    const key = handlers.pendingKey ?? request.jobId;
    setPendingKey(key);

    void ResultAsync.fromPromise(
      mutateAsync({ dataProviderName: "execution", resource: "job-control", values: request }),
      (error) => (error instanceof Error ? error.message : handlers.errorTitle),
    ).match(
      (response) => {
        setPendingKey(null);
        busy.current = false;
        handlers.onSuccess?.(response.data as T);
      },
      (error) => {
        setPendingKey(null);
        busy.current = false;
        toastStore.getState().addToast({ title: error, type: "error" });
      },
    );
  };

  return { control, pendingKey };
};

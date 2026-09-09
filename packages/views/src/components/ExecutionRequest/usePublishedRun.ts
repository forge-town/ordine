import { useCreate } from "@refinedev/core";
import { useCallback, useState } from "react";
import { useStore } from "zustand";
import { ResultAsync } from "neverthrow";
import { RunRequestInputSchema, type RunRequestInput, type RunRequestReceipt } from "@repo/schemas";
import { createExecutionWorkspaceStore } from "../../pages/ExecutionWorkspacePage/_store/store";

/** Publishing returns the saved revision; submission is never retried automatically. */
export const usePublishedRun = (recoveryKey: string) => {
  const [store] = useState(() => createExecutionWorkspaceStore(undefined, recoveryKey));
  const state = useStore(store);
  const { mutateAsync } = useCreate<RunRequestReceipt>({ mutationOptions: { retry: false } });
  const submit = async (
    prepare: () => Promise<Omit<RunRequestInput, "apiVersion" | "requestId">>,
  ) => {
    if (store.getState().pendingAction || store.getState().submission.phase !== "idle") return;
    store.getState().patch({ pendingAction: "准备运行", error: null });
    const result = await ResultAsync.fromPromise(
      Promise.resolve().then(async () => {
        const published = await prepare();
        const request = RunRequestInputSchema.parse({
          ...published,
          apiVersion: 2,
          requestId: crypto.randomUUID(),
        });
        if (!store.getState().startRequest(request)) return;
        store.getState().patch({ pendingAction: "提交运行请求" });
        const response = await mutateAsync({
          dataProviderName: "execution",
          resource: "run-requests",
          values: request,
        });
        store.getState().acceptReceipt(response.data);
      }),
      (error) => ({
        message: error instanceof Error ? error.message : "运行请求失败",
        definitive: Boolean(
          error &&
          typeof error === "object" &&
          "statusCode" in error &&
          typeof error.statusCode === "number" &&
          error.statusCode >= 400 &&
          error.statusCode < 500,
        ),
      }),
    );
    if (result.isErr()) {
      if (store.getState().submission.phase === "submitting")
        store.getState().failRequest(result.error.message, result.error.definitive);
      store.getState().patch({ error: result.error.message });
    }
    store.getState().patch({ pendingAction: null });
  };
  const handleReset = () => {
    if (
      store.getState().pendingAction ||
      !["accepted", "rejected", "expired", "invalid"].includes(store.getState().submission.phase)
    )
      return;
    store.getState().resetRequest();
    store.getState().patch({ error: null });
  };
  const handleReceipt = useCallback(
    (receipt: RunRequestReceipt) => {
      store.getState().acceptReceipt(receipt);
      if (store.getState().submission.phase !== "uncertain")
        store.getState().patch({ error: null });
    },
    [store],
  );

  return { state, submit, handleReset, handleReceipt };
};

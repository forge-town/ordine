import { useList, useOne } from "@refinedev/core";
import { useStore } from "zustand";
import type {
  PipelineDefinition,
  OperationRevision,
  ExecutionReadiness,
  ExecutionRuntimeConfigRecordSchema,
} from "@repo/schemas";
import { z } from "zod";
import { ResultAsync } from "neverthrow";
import { useExecutionStore } from "./_store";

export const useWorkspaceData = () => {
  const store = useExecutionStore();
  const state = useStore(store);
  const pipelines = useList<PipelineDefinition>({
    resource: "pipelines",
    pagination: { mode: "off" },
  });
  const operations = useList<OperationRevision>({
    resource: "operations",
    pagination: { mode: "off" },
  });
  const runtimes = useList<z.infer<typeof ExecutionRuntimeConfigRecordSchema>>({
    resource: "runtime-configs",
    pagination: { mode: "off" },
  });
  const readiness = useOne<ExecutionReadiness>({
    resource: "readiness",
    id: "current",
    queryOptions: { retry: false },
  });
  const pipeline =
    state.draft ??
    pipelines.result.data.find((entry) => entry.id === state.selectedPipelineId) ??
    null;
  const references = pipeline?.graph.nodes.map((node) => node.operation) ?? [];
  const pinned = useList<OperationRevision>({
    resource: "operation-revisions",
    meta: { references },
    pagination: { mode: "off" },
    queryOptions: { enabled: references.length > 0, retry: false },
  });
  const pinnedOperation = (operationId: string, revision: number) =>
    pinned.query.error
      ? undefined
      : [...pinned.result.data, ...operations.result.data].find(
          (entry) => entry.id === operationId && entry.revision === revision,
        );
  const edit = (update: (pipeline: PipelineDefinition) => PipelineDefinition) => {
    if (pipeline) store.getState().edit(update(pipeline));
  };
  const act = async <T>(name: string, action: () => Promise<T>, success?: (value: T) => void) => {
    if (store.getState().pendingAction) return;
    store.getState().patch({ pendingAction: name, error: null, notice: null });
    const result = await ResultAsync.fromPromise(Promise.resolve().then(action), (error) =>
      error instanceof z.ZodError
        ? error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n")
        : error instanceof Error
          ? error.message
          : "操作失败，请重试",
    );
    store.getState().patch({ pendingAction: null });
    if (result.isErr()) store.getState().patch({ error: result.error });
    else success?.(result.value);
  };

  return {
    pinned,
    pinnedOperation,
    store,
    state,
    pipelines,
    operations,
    runtimes,
    readiness,
    pipeline,
    edit,
    act,
    busy: state.pendingAction !== null,
  };
};

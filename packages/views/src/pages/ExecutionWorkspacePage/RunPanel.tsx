import { useCreate, useOne } from "@refinedev/core";
import { ResultAsync } from "neverthrow";
import { Card } from "@repo/ui/card";
import { Button } from "@repo/ui/button";
import { RunRequestInputSchema, type RunRequestReceipt } from "@repo/schemas";
import { useWorkspaceData } from "./useWorkspaceData";
import { useSavePipeline } from "./useSavePipeline";
import { RunInputs } from "./RunInputs";
import { ExecutionOptionsEditor } from "./ExecutionOptionsEditor";
import { ApprovalPanel } from "./ApprovalPanel";
import { JobPanel } from "./JobPanel";
import { ToggleField } from "./ToggleField";
import { TextField } from "./TextField";
export const RunPanel = () => {
  const { pipeline, pinnedOperation, state, store, readiness, busy, act } = useWorkspaceData();
  const save = useSavePipeline();
  const { mutateAsync } = useCreate<RunRequestReceipt>({ mutationOptions: { retry: false } });
  const receiptQuery = useOne<RunRequestReceipt>({
    resource: "run-requests",
    id: state.submission.request?.requestId ?? "none",
    queryOptions: { enabled: false, retry: false },
  });
  const run = async () => {
    if (!pipeline || store.getState().pendingAction || store.getState().submission.phase !== "idle")
      return;
    store.getState().patch({ pendingAction: "保存 Pipeline", error: null, notice: null });
    const result = await ResultAsync.fromPromise(
      Promise.resolve().then(async () => {
        const saved = state.dirty || pipeline.revision === 0 ? await save(pipeline) : pipeline;
        const request = RunRequestInputSchema.parse({
          apiVersion: 2,
          requestId: crypto.randomUUID(),
          pipelineId: saved.id,
          expectedRevision: saved.revision,
          inputs: store.getState().inputs,
          executionOverrides: store.getState().executionOverrides,
          deliveryRequirements: store.getState().deliveryRequirements,
        });
        if (!store.getState().startRequest(request)) return;
        store.getState().patch({ pendingAction: "提交运行请求" });
        const response = await mutateAsync({ resource: "run-requests", values: request });
        store.getState().acceptReceipt(response.data);
      }),
      (error) => ({
        message: error instanceof Error ? error.message : "运行请求失败",
        statusCode:
          error &&
          typeof error === "object" &&
          "statusCode" in error &&
          typeof error.statusCode === "number"
            ? error.statusCode
            : 0,
      }),
    );
    store.getState().patch({ pendingAction: null });
    if (result.isErr()) {
      if (store.getState().submission.phase === "submitting")
        store
          .getState()
          .failRequest(
            result.error.message,
            result.error.statusCode >= 400 && result.error.statusCode < 500,
          );
      store.getState().patch({ error: result.error.message });
    }
  };
  const deliveryPorts =
    pipeline?.graph.nodes.flatMap(
      (node) =>
        pinnedOperation(node.operation.operationId, node.operation.revision)?.outputPorts.map(
          (port) => ({ nodeId: node.id, port }),
        ) ?? [],
    ) ?? [];
  const handleChange1: NonNullable<
    React.ComponentProps<typeof ExecutionOptionsEditor>["onChange"]
  > = (executionOverrides) => store.getState().patch({ executionOverrides });
  const handleClick4: NonNullable<React.ComponentProps<typeof Button>["onClick"]> = () =>
    void run();
  const handleClick5: NonNullable<React.ComponentProps<typeof Button>["onClick"]> = () =>
    void act(
      "查询原请求",
      async () => {
        const response = await receiptQuery.query.refetch();
        if (response.error) throw response.error;
        if (!response.data) throw new Error("回执尚不可用，请稍后查询同一 requestId");

        return response.data.data;
      },
      (receipt) => store.getState().acceptReceipt(receipt),
    );
  const handleClick6: NonNullable<React.ComponentProps<typeof Button>["onClick"]> = () =>
    store.getState().resetRequest();

  return (
    <div className="space-y-5">
      {pipeline && (
        <Card className="space-y-5 p-5" variant="surface">
          <div>
            <h2 className="text-lg font-semibold">运行 {pipeline.name}</h2>
            <p className="text-sm text-muted-foreground">
              {state.submission.request && state.submission.phase !== "idle"
                ? `当前请求固定 Pipeline r${state.submission.request.expectedRevision}，编辑稿不会改变已提交快照。`
                : state.dirty
                  ? "先保存修改，再用实际保存修订提交。"
                  : `使用已保存修订 r${pipeline.revision}。`}
              提交、审批与执行结果分别显示。
            </p>
          </div>
          <fieldset className="space-y-5" disabled={busy || state.submission.phase !== "idle"}>
            <RunInputs />
            <details>
              <summary className="cursor-pointer font-medium">本次运行参数覆盖</summary>
              <div className="pt-3">
                <ExecutionOptionsEditor value={state.executionOverrides} onChange={handleChange1} />
              </div>
            </details>
            <div className="space-y-3">
              <h3 className="font-medium">交付要求</h3>
              <p className="text-xs text-muted-foreground">
                勾选必须产生内容的节点端口；任务状态成功仍需核对输出与文件。
              </p>
              {deliveryPorts.map(({ nodeId, port }) => {
                const requirement = state.deliveryRequirements.find(
                  (item) => item.nodeId === nodeId && item.portId === port.id,
                );
                const handleChange2: NonNullable<
                  React.ComponentProps<typeof ToggleField>["onChange"]
                > = (enabled) =>
                  store.getState().patch({
                    deliveryRequirements: enabled
                      ? [
                          ...state.deliveryRequirements,
                          { nodeId, portId: port.id, minimumItems: 1 },
                        ]
                      : state.deliveryRequirements.filter((item) => item !== requirement),
                  });
                const handleChange3: NonNullable<
                  React.ComponentProps<typeof TextField>["onChange"]
                > = (value) =>
                  store.getState().patch({
                    deliveryRequirements: state.deliveryRequirements.map((item) =>
                      item === requirement ? { ...item, minimumItems: Number(value) } : item,
                    ),
                  });

                return (
                  <div key={`${nodeId}:${port.id}`} className="flex flex-wrap items-end gap-3">
                    <ToggleField
                      checked={Boolean(requirement)}
                      label={`${nodeId.slice(0, 18)}… / ${port.id} · ${port.valueType}`}
                      onChange={handleChange2}
                    />
                    {requirement && (
                      <div className="w-36">
                        <TextField
                          label="最少交付项数"
                          type="number"
                          value={requirement.minimumItems}
                          onChange={handleChange3}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </fieldset>
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={
                busy ||
                state.submission.phase !== "idle" ||
                readiness.result?.status !== "ready" ||
                pipeline.graph.nodes.length === 0
              }
              onClick={handleClick4}
            >
              {state.dirty || pipeline.revision === 0 ? "保存并提交运行请求" : "提交运行请求"}
            </Button>
            {state.submission.phase !== "idle" && state.submission.request && (
              <Button disabled={busy} variant="outline" onClick={handleClick5}>
                查询原 requestId
              </Button>
            )}
            {["accepted", "rejected", "expired", "invalid"].includes(state.submission.phase) && (
              <Button disabled={busy} variant="ghost" onClick={handleClick6}>
                配置另一次运行
              </Button>
            )}
          </div>
          {state.submission.request && (
            <div className="space-y-2 rounded-lg bg-surface-2 p-3">
              <p className="font-medium">
                请求状态：
                {
                  {
                    idle: "尚未提交",
                    submitting: "正在提交",
                    uncertain: "结果未知，可恢复查询",
                    awaiting_approval: "等待用户审批",
                    accepted: "已接受，查询 Job",
                    rejected: "用户已拒绝",
                    expired: "请求已过期",
                    invalid: "输入无效",
                  }[state.submission.phase]
                }
              </p>
              <p className="break-all text-xs">requestId：{state.submission.request.requestId}</p>
              {state.submission.error && (
                <p className="text-sm text-destructive" role="alert">
                  {state.submission.error}
                </p>
              )}
              {state.submission.phase === "uncertain" && (
                <p className="text-sm">
                  不要创建替代 requestId 或重复启动。请查询此请求，确认服务端结果。
                </p>
              )}
            </div>
          )}
        </Card>
      )}
      {!pipeline && (
        <Card className="p-5 text-sm text-muted-foreground" variant="surface">
          先选择 Pipeline，再配置输入并提交。
        </Card>
      )}
      <ApprovalPanel />
      <JobPanel />
    </div>
  );
};

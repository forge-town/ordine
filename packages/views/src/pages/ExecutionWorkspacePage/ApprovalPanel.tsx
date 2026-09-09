import { useCreate, useOne } from "@refinedev/core";
import { Card } from "@repo/ui/card";
import { Button } from "@repo/ui/button";
import type { ExecutionApproval, RunRequestReceipt } from "@repo/schemas";
import { useWorkspaceData } from "./useWorkspaceData";
export const ApprovalPanel = () => {
  const { state, store, act, busy } = useWorkspaceData();
  const receipt = state.submission.receipt;
  const approvalId = receipt?.state === "awaiting_approval" ? receipt.approvalId : undefined;
  const { result: approval, query } = useOne<ExecutionApproval>({
    resource: "approvals",
    id: approvalId ?? "none",
    queryOptions: {
      enabled: Boolean(approvalId),
      retry: false,
      refetchInterval: approvalId ? 5000 : false,
    },
  });
  const { mutateAsync } = useCreate<RunRequestReceipt>({ mutationOptions: { retry: false } });
  if (!approvalId) return null;
  const prepared = approval?.prepared;
  const allowed = approval?.state === "pending" && Date.parse(approval.expiresAt) > Date.now();
  const handleClick1: NonNullable<React.ComponentProps<typeof Button>["onClick"]> = () =>
    void query.refetch();
  const handleClick2: NonNullable<React.ComponentProps<typeof Button>["onClick"]> = () =>
    void act(
      "批准运行",
      () =>
        mutateAsync({
          resource: "approval-actions",
          values: { approvalId, action: "approve" },
        }),
      (response) => store.getState().acceptReceipt(response.data),
    );
  const handleClick3: NonNullable<React.ComponentProps<typeof Button>["onClick"]> = () =>
    void act(
      "拒绝运行",
      () =>
        mutateAsync({
          resource: "approval-actions",
          values: { approvalId, action: "reject" },
        }),
      (response) => store.getState().acceptReceipt(response.data),
    );

  return (
    <Card className="space-y-4 p-5" variant="surface">
      <div>
        <h2 className="text-lg font-semibold">等待你的审批</h2>
        <p className="text-sm text-muted-foreground">
          此面板展示服务端冻结的 PreparedRun。批准后才会创建或接受 Job。
        </p>
      </div>
      {query.isLoading && <p role="status">读取审批快照…</p>}
      {query.error && (
        <p className="text-sm text-destructive" role="alert">
          {query.error.message}
          <Button variant="outline" onClick={handleClick1}>
            重试
          </Button>
        </p>
      )}
      {prepared && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <span className="text-xs text-muted-foreground">Pipeline 修订</span>
              <p>
                {prepared.pipeline.name} · r{prepared.pipeline.revision}
              </p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">审批有效期</span>
              <p>{new Date(approval.expiresAt).toLocaleString()}</p>
            </div>
          </div>
          <div className="rounded-lg bg-surface-2 p-3">
            <h3 className="font-medium">执行风险</h3>
            {prepared.risk.reasons.map((reason, index) => (
              <p key={index} className="mt-1 text-sm">
                {reason}
              </p>
            ))}
          </div>
          {prepared.operations.map((operation) => (
            <details
              key={`${operation.id}:${operation.revision}`}
              className="rounded-lg bg-surface-2 p-3"
            >
              <summary className="cursor-pointer text-sm font-medium">
                {operation.name} · r{operation.revision} · {operation.executor.kind}
              </summary>
              {operation.executor.kind === "script" && (
                <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs">
                  {operation.executor.source}
                </pre>
              )}
              {operation.executor.kind === "agent" && (
                <p className="mt-3 whitespace-pre-wrap text-sm">{operation.executor.instruction}</p>
              )}
            </details>
          ))}
          <h3 className="font-medium">参数与来源</h3>
          {Object.entries(prepared.resolvedNodes).map(([nodeId, resolved]) => (
            <div key={nodeId} className="min-w-0 rounded-lg bg-surface-2 p-3 text-sm">
              <p className="break-all font-medium">{nodeId}</p>
              <div className="mt-2 grid gap-1 sm:grid-cols-2">
                {Object.entries(resolved)
                  .filter(([key]) => !["origins", "timeouts", "executableSha256"].includes(key))
                  .map(([key, value]) => (
                    <p key={key} className="break-all">
                      <span className="text-muted-foreground">{key}: </span>
                      {String(value)}{" "}
                      <span className="text-xs text-muted-foreground">
                        {resolved.origins[key as keyof typeof resolved.origins] ?? "固定快照"}
                      </span>
                    </p>
                  ))}
                {Object.entries(resolved.timeouts).map(([key, value]) => (
                  <p key={key}>
                    {key}: {value} ms ·{" "}
                    {resolved.origins[key as keyof typeof resolved.origins] ?? "policy"}
                  </p>
                ))}
              </div>
            </div>
          ))}
          <h3 className="font-medium">冻结输入</h3>
          {Object.entries(prepared.inputs).map(([port, values]) => (
            <div key={port} className="rounded-lg bg-surface-2 p-3 text-sm">
              <strong>{port}</strong>
              {values.map((value, index) => (
                <p key={index} className="mt-1 whitespace-pre-wrap break-all">
                  {value.kind === "artifact"
                    ? `Artifact ${value.artifactId}`
                    : value.kind === "text"
                      ? value.value
                      : JSON.stringify(value.value)}
                </p>
              ))}
            </div>
          ))}
          {prepared.inputArtifacts.map((asset) => (
            <div key={asset.artifactId} className="break-all text-xs">
              <p>
                {asset.name} · {asset.sizeBytes} bytes · {asset.source.kind}
              </p>
              <p>SHA-256 {asset.sha256}</p>
            </div>
          ))}
          <p className="break-all text-xs text-muted-foreground">
            PreparedRun SHA-256：{prepared.contentHash}
          </p>
        </>
      )}
      <div className="flex flex-wrap gap-3">
        <Button disabled={busy || !allowed} onClick={handleClick2}>
          批准此快照并运行
        </Button>
        <Button disabled={busy || !allowed} variant="outline" onClick={handleClick3}>
          拒绝
        </Button>
        {approval && !allowed && (
          <p className="text-sm text-muted-foreground">
            审批状态：{approval.state}。请查询回执恢复最新状态。
          </p>
        )}
      </div>
    </Card>
  );
};

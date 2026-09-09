import { useRef, useState } from "react";
import { useCreate, useOne } from "@refinedev/core";
import { ResultAsync } from "neverthrow";
import type { ExecutionApproval, RunRequestReceipt } from "@repo/schemas";
import { Button } from "@repo/ui/button";

export const ExecutionApprovalCard = ({
  approvalId,
  onDecision,
}: {
  approvalId: string;
  onDecision: () => void;
}) => {
  const { result: approval, query } = useOne<ExecutionApproval>({
    dataProviderName: "execution",
    resource: "approvals",
    id: approvalId,
    queryOptions: { retry: false, refetchInterval: 5000 },
  });
  const { mutateAsync } = useCreate<RunRequestReceipt>({ mutationOptions: { retry: false } });
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleDecide = async (action: "approve" | "reject") => {
    if (
      lock.current ||
      !approval ||
      approval.state !== "pending" ||
      Date.parse(approval.expiresAt) <= Date.now()
    )
      return;
    lock.current = true;
    setBusy(true);
    setError(null);
    const response = await ResultAsync.fromPromise(
      mutateAsync({
        dataProviderName: "execution",
        resource: "approval-actions",
        values: { approvalId, action },
      }),
      (cause) => (cause instanceof Error ? cause.message : "审批结果暂时无法确认，请查询原请求。"),
    );
    lock.current = false;
    setBusy(false);
    if (response.isErr()) setError(response.error);
    onDecision();
    void query.refetch();
  };
  const pending = approval?.state === "pending" && Date.parse(approval.expiresAt) > Date.now();
  const handleRetry = () => void query.refetch();
  const handleApprove = () => void handleDecide("approve");
  const handleReject = () => void handleDecide("reject");

  return (
    <article
      className="space-y-3 rounded-xl border border-warning/35 bg-warning/5 p-3 text-xs"
      data-testid="execution-approval-card"
    >
      <p className="font-medium">确认此次运行</p>
      {query.isLoading && <p role="status">读取已准备的执行内容…</p>}
      {query.error && <p role="alert">{query.error.message}</p>}
      {approval && (
        <>
          <p>
            {approval.prepared.pipeline.name} · 修订 {approval.prepared.pipeline.revision}
          </p>
          <p className="text-muted-foreground">
            确认仅用于以下固定内容。修改流程或参数后需要重新提交。
          </p>
          {approval.prepared.operations.map((operation) => (
            <details key={`${operation.id}:${operation.revision}`}>
              <summary className="cursor-pointer font-medium">
                {operation.name} · 修订 {operation.revision}
              </summary>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words">
                {operation.executor.kind === "agent"
                  ? operation.executor.instruction
                  : operation.executor.kind === "script"
                    ? operation.executor.source
                    : operation.executor.name}
              </pre>
            </details>
          ))}
          <details>
            <summary className="cursor-pointer">参数与输入来源</summary>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words">
              {JSON.stringify(
                {
                  inputs: approval.prepared.inputs,
                  inputArtifacts: approval.prepared.inputArtifacts,
                  execution: approval.prepared.resolvedNodes,
                },
                null,
                2,
              )}
            </pre>
          </details>
          {approval.prepared.risk.reasons.map((reason) => (
            <p key={reason} className="text-muted-foreground">
              {reason}
            </p>
          ))}
          <p className="text-muted-foreground">
            有效期至 {new Date(approval.expiresAt).toLocaleTimeString()}
          </p>
        </>
      )}
      {error && (
        <p className="text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button disabled={!pending || busy} size="sm" onClick={handleApprove}>
          {busy ? "正在确认…" : "确认运行"}
        </Button>
        <Button disabled={!pending || busy} size="sm" variant="outline" onClick={handleReject}>
          拒绝
        </Button>
        {query.error && (
          <Button size="sm" variant="ghost" onClick={handleRetry}>
            重试
          </Button>
        )}
      </div>
    </article>
  );
};

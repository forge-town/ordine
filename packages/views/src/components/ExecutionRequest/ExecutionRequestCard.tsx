import { useOne } from "@refinedev/core";
import { useEffect } from "react";
import type { ExecutionJob, ExecutionEvent, RunRequestReceipt } from "@repo/schemas";
import { Button } from "@repo/ui/button";
import { ExecutionApprovalCard } from "./ExecutionApprovalCard";
import { ExecutionJobCard } from "./ExecutionJobCard";

export const ExecutionRequestCard = ({
  requestId,
  onReceipt,
  onJob: handleJob,
  onEvents: handleEvents,
}: {
  requestId: string;
  onReceipt?: (receipt: RunRequestReceipt) => void;
  onJob?: (job: ExecutionJob) => void;
  onEvents?: (events: ExecutionEvent[]) => void;
}) => {
  const { result: receipt, query } = useOne<RunRequestReceipt>({
    dataProviderName: "execution",
    resource: "run-requests",
    id: requestId,
    queryOptions: {
      retry: false,
      refetchInterval: (current) =>
        current.state.errorUpdateCount > 5
          ? false
          : !current.state.data || current.state.data.data.state === "awaiting_approval"
            ? 2500
            : false,
    },
  });
  useEffect(() => {
    if (receipt) onReceipt?.(receipt);
  }, [onReceipt, receipt]);
  const handleRefresh = () => void query.refetch();
  if (receipt?.state === "accepted")
    return (
      <ExecutionJobCard
        key={receipt.jobId}
        jobId={receipt.jobId}
        onEvents={handleEvents}
        onJob={handleJob}
      />
    );
  if (receipt?.state === "awaiting_approval")
    return <ExecutionApprovalCard approvalId={receipt.approvalId} onDecision={handleRefresh} />;

  return (
    <article
      className="space-y-2 rounded-xl border border-border bg-background p-3 text-xs"
      data-testid="execution-request-card"
    >
      <p className="font-medium">运行请求</p>
      {query.isLoading && <p role="status">正在确认提交结果…</p>}
      {query.error && <p role="alert">{query.error.message} 请查询原请求，勿重复提交。</p>}
      {receipt?.state === "invalid" && <p role="alert">{receipt.error.message}</p>}
      {receipt?.state === "rejected" && <p>你已拒绝此次运行。</p>}
      {receipt?.state === "expired" && <p>此次运行请求已过期。</p>}
      {query.error && (
        <Button size="sm" variant="outline" onClick={handleRefresh}>
          查询原请求
        </Button>
      )}
    </article>
  );
};

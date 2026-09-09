import { Button } from "@repo/ui/button";
import type { RunRequestReceipt } from "@repo/schemas";
import type { SubmissionState } from "../../execution/submission";
import { ExecutionRequestCard } from "./ExecutionRequestCard";

export const PublishedRunStatus = ({
  submission,
  error,
  busy,
  onReset: handleReset,
  onReceipt: handleReceipt,
}: {
  submission: SubmissionState;
  error: string | null;
  busy: boolean;
  onReset: () => void;
  onReceipt: (receipt: RunRequestReceipt) => void;
}) => (
  <div className="space-y-3">
    {(error || submission.error) && (
      <p className="text-sm text-destructive" role="alert">
        {error || submission.error}
      </p>
    )}
    {submission.request && (
      <>
        <p className="break-all text-xs text-muted-foreground">
          requestId：{submission.request.requestId} · Pipeline r
          {submission.request.expectedRevision}
        </p>
        {submission.phase === "uncertain" && (
          <p className="text-sm">结果未知，请查询原请求恢复；请勿重复提交。</p>
        )}
        {submission.phase === "submitting" && <p role="status">正在提交运行请求…</p>}
        {submission.phase !== "submitting" &&
          !(submission.phase === "invalid" && !submission.receipt) && (
            <ExecutionRequestCard
              key={submission.request.requestId}
              requestId={submission.request.requestId}
              onReceipt={handleReceipt}
            />
          )}
      </>
    )}
    {["accepted", "rejected", "expired", "invalid"].includes(submission.phase) && (
      <Button disabled={busy} size="sm" variant="outline" onClick={handleReset}>
        配置另一次运行
      </Button>
    )}
  </div>
);

import { useOne } from "@refinedev/core";
import { useStore } from "zustand";
import type { ExecutionJob, ExecutionJobResult } from "@repo/schemas";
import { useExecutionStore } from "./_store";
export const jobLabels: Record<ExecutionJob["state"], string> = {
  queued: "排队中",
  running: "执行中",
  pausing: "正在暂停",
  paused: "已暂停",
  waiting_for_input: "等待检查点确认",
  cancelling: "正在取消",
  succeeded: "执行成功",
  failed: "执行失败",
  cancelled: "已取消",
  timed_out: "已超时",
  interrupted: "执行中断",
};
export const terminalStates = ["succeeded", "failed", "cancelled", "timed_out", "interrupted"];
export const useJobData = () => {
  const jobId = useStore(useExecutionStore(), (state) => state.selectedJobId);
  const job = useOne<ExecutionJob>({
    resource: "jobs",
    id: jobId ?? "none",
    queryOptions: {
      enabled: Boolean(jobId),
      retry: false,
      refetchInterval: (query) =>
        terminalStates.includes(query.state.data?.data.state ?? "") ? false : 1500,
    },
  });
  const result = useOne<ExecutionJobResult>({
    resource: "job-results",
    id: jobId ?? "none",
    queryOptions: {
      enabled: Boolean(jobId),
      retry: false,
      refetchInterval: (query) =>
        terminalStates.includes(query.state.data?.data.state ?? "") ? false : 1500,
    },
  });

  return {
    jobId,
    job,
    result,
    live: Boolean(job.result && !terminalStates.includes(job.result.state)),
  };
};

import { useMemo } from "react";
import { useCustom, useList } from "@refinedev/core";
import type { Job, JobTrace } from "@repo/schemas";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { useCanvasStore } from "../canvas/_store/canvasStore";
import { buildUserActionRequests, type UserActionRequest } from "./userActionRequests";

/**
 * G3-03：执行器用户请求的数据源。
 * - 运行中：canvasStore.runTraces 实时派生（既有 1.5s 轮询通道）。
 * - 运行结束/页面重载：回退到该 pipeline 最近一次 job 的 traces（一次性拉取）——
 *   "执行器请你补配置"恰恰是跑完之后最需要看到的信息，不能随 run 卸载而消失。
 */
export const useUserActionRequests = (pipelineId: string | null): UserActionRequest[] => {
  const activeJobId = useCanvasStore((state) => state.activeJobId);
  const runTraces = useCanvasStore((state) => state.runTraces);

  const { result: jobsResult } = useList<Job>({
    queryOptions: { enabled: Boolean(pipelineId) && !activeJobId, retry: false },
    resource: ResourceName.jobs,
  });
  const settledJob = useMemo(() => {
    if (!pipelineId) {
      return null;
    }
    const candidates = jobsResult.data.filter((job) => job.pipelineId === pipelineId);

    const startedTime = (job: Job) => (job.startedAt ? new Date(job.startedAt).getTime() : 0);

    return [...candidates].sort((a, b) => startedTime(b) - startedTime(a))[0] ?? null;
  }, [jobsResult.data, pipelineId]);

  const { result: tracesResult } = useCustom<{ traces: JobTrace[] }>({
    config: { payload: { jobId: settledJob?.id ?? "" } },
    method: "get",
    queryOptions: { enabled: Boolean(settledJob) && !activeJobId, retry: false },
    url: "jobs/traces",
  });

  return useMemo(() => {
    const traces = activeJobId ? runTraces : (tracesResult?.data?.traces ?? []);

    return buildUserActionRequests(traces);
  }, [activeJobId, runTraces, tracesResult?.data?.traces]);
};

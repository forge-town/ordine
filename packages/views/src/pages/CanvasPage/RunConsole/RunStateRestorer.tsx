import { useEffect, useMemo, useRef } from "react";
import { useList } from "@refinedev/core";
import { useStore } from "zustand";
import type { Job } from "@repo/schemas";
import { ResourceName } from "../../../constants";
import { useCanvasPageStore } from "../_store";

const getJobTimestamp = (job: Job): number => {
  const value = job.meta?.createdAt ?? job.startedAt ?? job.finishedAt;

  return value ? new Date(value).getTime() : 0;
};

export const findLatestPipelineJob = (jobs: Job[], pipelineId: string): Job | null =>
  jobs.reduce<Job | null>((latest, job) => {
    if (job.pipelineId !== pipelineId) {
      return latest;
    }

    return !latest || getJobTimestamp(job) > getJobTimestamp(latest) ? job : latest;
  }, null);

export const RunStateRestorer = () => {
  const store = useCanvasPageStore();
  const pipelineId = useStore(store, (state) => state.pipelineId);
  const restoreRunState = useStore(store, (state) => state.restoreRunState);
  const restoredKeyRef = useRef<string | null>(null);
  const { result } = useList<Job>({
    resource: ResourceName.jobs,
    queryOptions: { enabled: pipelineId !== null },
  });
  const latestJob = useMemo(
    () => (pipelineId ? findLatestPipelineJob(result.data, pipelineId) : null),
    [pipelineId, result.data],
  );

  useEffect(() => {
    if (!pipelineId || !latestJob) {
      return;
    }

    const restoreKey = `${pipelineId}:${latestJob.id}`;
    if (restoredKeyRef.current === restoreKey) {
      return;
    }

    restoredKeyRef.current = restoreKey;
    restoreRunState(latestJob);
  }, [latestJob, pipelineId, restoreRunState]);

  return null;
};

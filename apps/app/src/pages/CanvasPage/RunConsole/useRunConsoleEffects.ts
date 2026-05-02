import { useEffect } from "react";
import type { JobData, JobStatus } from "./types";

interface TraceMessage {
  message: string;
}

interface UseRunConsoleEffectsParams {
  applyStructuredTraceLogs: (jobId: string, logs: string[]) => void;
  job: JobData | null;
  jobId: string | null;
  stopTestRun: () => void;
  traces: TraceMessage[];
}

export const isTerminalStatus = (status: JobStatus) =>
  status === "done" || status === "failed" || status === "cancelled" || status === "expired";

export const useRunConsoleEffects = ({
  applyStructuredTraceLogs,
  job,
  jobId,
  stopTestRun,
  traces,
}: UseRunConsoleEffectsParams) => {
  useEffect(() => {
    if (job && isTerminalStatus(job.status)) {
      stopTestRun();
    }
  }, [job, stopTestRun]);

  useEffect(() => {
    if (!jobId || traces.length === 0) return;

    const logs = traces.map((trace) => trace.message);
    applyStructuredTraceLogs(jobId, logs);
  }, [applyStructuredTraceLogs, jobId, traces]);
};

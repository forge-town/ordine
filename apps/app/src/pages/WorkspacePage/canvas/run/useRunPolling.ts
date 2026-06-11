import { useEffect, useRef } from "react";
import { useCustom, useDataProvider, useOne } from "@refinedev/core";
import type { Job, JobStatus, JobTrace } from "@repo/schemas";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { useCanvasStore } from "../_store/canvasStore";

const POLL_INTERVAL = 1500;
const TERMINAL_STATUSES = new Set<JobStatus>(["cancelled", "done", "expired", "failed"]);

type RawTrace = {
  createdAt?: Date | string;
  id?: number;
  level?: JobTrace["level"];
  message: string;
};

const LLM_CONTENT_PREFIX = "@@LLM_CONTENT::";

const stripTimestamp = (message: string): string => message.replace(/^\[[^\]]+\]\s*/, "");

export const isTerminalJobStatus = (status: JobStatus): boolean => TERMINAL_STATUSES.has(status);

const toJobTrace = (raw: RawTrace, index: number): JobTrace => ({
  createdAt: raw.createdAt ? new Date(raw.createdAt) : new Date(0),
  id: raw.id ?? index,
  jobId: "",
  level: raw.level ?? "info",
  message: raw.message,
});

export const useRunPolling = () => {
  const activeJobId = useCanvasStore((state) => state.activeJobId);
  const applyJobSnapshot = useCanvasStore((state) => state.applyJobSnapshot);
  const applyNodeLlmContent = useCanvasStore((state) => state.applyNodeLlmContent);
  const setRunTraces = useCanvasStore((state) => state.setRunTraces);
  const getDataProvider = useDataProvider();
  const dataProvider = getDataProvider();
  const jobRef = useRef<Job | null>(null);

  const { query: jobQuery } = useOne<Job>({
    id: activeJobId ?? "",
    queryOptions: {
      enabled: activeJobId !== null,
      refetchInterval: (query) => {
        const status = (query.state.data?.data as Job | undefined)?.status;

        return status && isTerminalJobStatus(status) ? false : POLL_INTERVAL;
      },
    },
    resource: ResourceName.jobs,
  });
  const job = (jobQuery?.data?.data as Job | undefined) ?? null;
  jobRef.current = job;

  useEffect(() => {
    if (job) {
      applyJobSnapshot(job);
    }
  }, [applyJobSnapshot, job]);

  const { result: tracesResult } = useCustom<{ traces: RawTrace[] }>({
    config: { payload: { jobId: activeJobId ?? "" } },
    method: "get",
    queryOptions: {
      enabled: activeJobId !== null,
      queryFn: async () => {
        const response = await dataProvider.custom!<{ traces: RawTrace[] }>({
          method: "get",
          payload: { jobId: activeJobId ?? "" },
          url: "jobs/traces",
        });

        for (const trace of response.data.traces) {
          const message = stripTimestamp(trace.message);
          if (!message.startsWith(LLM_CONTENT_PREFIX)) {
            continue;
          }
          const rest = message.slice(LLM_CONTENT_PREFIX.length);
          const separatorIndex = rest.indexOf("::");
          if (separatorIndex !== -1) {
            applyNodeLlmContent(rest.slice(0, separatorIndex), rest.slice(separatorIndex + 2));
          }
        }

        return response;
      },
      refetchInterval: () =>
        jobRef.current && isTerminalJobStatus(jobRef.current.status) ? false : POLL_INTERVAL,
    },
    url: "jobs/traces",
  });

  const traces = tracesResult?.data?.traces ?? [];

  useEffect(() => {
    setRunTraces(traces.map(toJobTrace));
    // The traces array identity changes per poll; mapping is cheap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setRunTraces, traces.length, activeJobId]);
};

export const RunPoller = () => {
  useRunPolling();

  return null;
};

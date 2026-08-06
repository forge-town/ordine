import { useEffect, useRef } from "react";
import { useStore } from "zustand";
import { Result } from "neverthrow";
import { useCustom, useDataProvider, useOne } from "@refinedev/core";
import { useTranslation } from "react-i18next";
import {
  NodeArtifactSchema,
  TRACE_MARKER,
  type Job,
  type JobStatus,
  type JobTrace,
} from "@repo/schemas";
import { useNotificationStore } from "@repo/views/store/notificationStore";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { useCanvasStore } from "../_store/canvasStore";

const POLL_INTERVAL = 1500;
const TERMINAL_STATUSES = new Set<JobStatus>(["cancelled", "done", "expired", "failed", "skipped"]);

type RawTrace = {
  createdAt?: Date | string;
  id?: number;
  level?: JobTrace["level"];
  message: string;
};

const stripTimestamp = (message: string): string => message.replace(/^\[[^\]]+\]\s*/, "");

const splitNodeIdPayload = (rest: string): { nodeId: string; payload: string } | null => {
  const separatorIndex = rest.indexOf("::");

  return separatorIndex === -1
    ? null
    : { nodeId: rest.slice(0, separatorIndex), payload: rest.slice(separatorIndex + 2) };
};

const safeJsonParse = Result.fromThrowable(
  (raw: string): unknown => JSON.parse(raw),
  () => null,
);

export const isTerminalJobStatus = (status: JobStatus): boolean => TERMINAL_STATUSES.has(status);

const toJobTrace = (raw: RawTrace, index: number, jobId: string): JobTrace => ({
  createdAt: raw.createdAt ? new Date(raw.createdAt) : new Date(0),
  id: raw.id ?? index,
  jobId,
  level: raw.level ?? "info",
  message: raw.message,
});

export const useRunPolling = () => {
  const activeJobId = useCanvasStore((state) => state.activeJobId);
  const applyJobSnapshot = useCanvasStore((state) => state.applyJobSnapshot);
  const applyNodeArtifact = useCanvasStore((state) => state.applyNodeArtifact);
  const applyNodeLlmContent = useCanvasStore((state) => state.applyNodeLlmContent);
  const setRunTraces = useCanvasStore((state) => state.setRunTraces);
  const notificationStore = useNotificationStore();
  const addNotification = useStore(notificationStore, (state) => state.addNotification);
  const notificationPreferences = useStore(notificationStore, (state) => state.preferences);
  const getDataProvider = useDataProvider();
  const dataProvider = getDataProvider();
  const jobRef = useRef<Job | null>(null);
  const notifiedJobIdRef = useRef<string | null>(null);
  const notifiedWaitingRef = useRef<string | null>(null);
  const { t } = useTranslation();

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

  useEffect(() => {
    if (!job || !isTerminalJobStatus(job.status) || notifiedJobIdRef.current === job.id) {
      return;
    }
    notifiedJobIdRef.current = job.id;
    if (
      (job.status === "done" && !notificationPreferences.done) ||
      (job.status === "failed" && !notificationPreferences.failed)
    ) {
      return;
    }

    addNotification({
      id: `job-${job.id}-${job.status}`,
      kind: job.status === "done" ? "success" : job.status === "failed" ? "error" : "info",
      message: t(`workspace.canvas.run.notifications.${job.status}`, { title: job.title }),
      route: `/pipelines/jobs/${job.id}`,
    });
  }, [addNotification, job, notificationPreferences.done, notificationPreferences.failed, t]);

  useEffect(() => {
    if (!job || !notificationPreferences.waiting) {
      return;
    }
    const waitingNodeId = Object.entries(job.nodeStatuses ?? {}).find(
      ([, status]) => status === "waitingForUser",
    )?.[0];
    if (!waitingNodeId) {
      return;
    }
    const dedupeKey = `${job.id}:${waitingNodeId}`;
    if (notifiedWaitingRef.current === dedupeKey) {
      return;
    }
    notifiedWaitingRef.current = dedupeKey;
    addNotification({
      id: `job-${dedupeKey}-waiting`,
      kind: "warning",
      message: t("workspace.canvas.run.notifications.waiting", { title: job.title }),
      route: `/pipelines/jobs/${job.id}`,
    });
  }, [addNotification, job, notificationPreferences.waiting, t]);

  const { result: tracesResult } = useCustom<{ traces: RawTrace[] }>({
    config: { payload: { jobId: activeJobId ?? "" } },
    method: "get",
    queryOptions: {
      enabled: activeJobId !== null,
      queryFn: async () => {
        const jobId = activeJobId ?? "";
        const response = await dataProvider.custom!<{ traces: RawTrace[] }>({
          method: "get",
          payload: { jobId },
          url: "jobs/traces",
        });

        for (const trace of response.data.traces) {
          const message = stripTimestamp(trace.message);
          if (message.startsWith(TRACE_MARKER.llmContent)) {
            const parts = splitNodeIdPayload(message.slice(TRACE_MARKER.llmContent.length));
            if (parts) {
              applyNodeLlmContent(parts.nodeId, parts.payload);
            }
          } else if (message.startsWith(TRACE_MARKER.nodeArtifact)) {
            const parts = splitNodeIdPayload(message.slice(TRACE_MARKER.nodeArtifact.length));
            if (parts) {
              const parsed = NodeArtifactSchema.safeParse(
                safeJsonParse(parts.payload).unwrapOr(null),
              );
              if (parsed.success) {
                applyNodeArtifact(parts.nodeId, parsed.data);
              }
            }
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
    setRunTraces(traces.map((trace, index) => toJobTrace(trace, index, activeJobId ?? "")));
    // Refine replaces the result array on every poll; length and job id are the stable signals.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeJobId, setRunTraces, traces.length]);
};

export const RunPoller = () => {
  useRunPolling();

  return null;
};

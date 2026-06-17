import { useEffect, useRef } from "react";
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
import { ResourceName } from "@/integrations/refine/dataProvider";
import { useNotificationStore } from "@/store/notificationStore";
import { useNotificationPrefsStore } from "@/store/notificationStore/notificationPrefsStore";
import { useCanvasStore } from "../_store/canvasStore";

const POLL_INTERVAL = 1500;
const TERMINAL_STATUSES = new Set<JobStatus>(["cancelled", "done", "expired", "failed"]);

type RawTrace = {
  createdAt?: Date | string;
  id?: number;
  level?: JobTrace["level"];
  message: string;
};

const LLM_CONTENT_PREFIX = TRACE_MARKER.llmContent;
const NODE_ARTIFACT_PREFIX = TRACE_MARKER.nodeArtifact;

const stripTimestamp = (message: string): string => message.replace(/^\[[^\]]+\]\s*/, "");

/** 按首个 `::` 切出 (nodeId, payload)；payload 内可能含 `::`，故不能 split。 */
const splitNodeIdPayload = (rest: string): { nodeId: string; payload: string } | null => {
  const separatorIndex = rest.indexOf("::");
  if (separatorIndex === -1) return null;

  return { nodeId: rest.slice(0, separatorIndex), payload: rest.slice(separatorIndex + 2) };
};

const safeJsonParse = Result.fromThrowable(
  (raw: string): unknown => JSON.parse(raw),
  () => null,
);

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
  const applyNodeArtifact = useCanvasStore((state) => state.applyNodeArtifact);
  const setRunTraces = useCanvasStore((state) => state.setRunTraces);
  const getDataProvider = useDataProvider();
  const dataProvider = getDataProvider();
  const jobRef = useRef<Job | null>(null);
  const { t } = useTranslation();
  const addNotification = useNotificationStore((state) => state.addNotification);
  const notifiedJobIdRef = useRef<string | null>(null);
  const notifiedWaitingRef = useRef<string | null>(null);
  const notificationPrefs = useNotificationPrefsStore();

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

  // G3-06：run 终态派发通知中心事件（每个 job 只派发一次）；
  // N18-04：done/failed 受通知偏好控制（cancelled/expired 始终提示）。
  useEffect(() => {
    if (!job || !isTerminalJobStatus(job.status) || notifiedJobIdRef.current === job.id) {
      return;
    }
    notifiedJobIdRef.current = job.id;
    if (
      (job.status === "done" && !notificationPrefs.done) ||
      (job.status === "failed" && !notificationPrefs.failed)
    ) {
      return;
    }
    const kind = job.status === "done" ? "success" : job.status === "failed" ? "error" : "info";
    addNotification({
      id: `job-${job.id}-${job.status}`,
      kind,
      message: t(`workspace.canvas.run.notifications.${job.status}`, { title: job.title }),
      route: `/pipelines/jobs/${job.id}`,
    });
  }, [addNotification, job, notificationPrefs.done, notificationPrefs.failed, t]);

  // N18-04：节点进入 waitingForUser 时派发提醒（每个 job+node 一次，受偏好控制）。
  useEffect(() => {
    if (!job || !notificationPrefs.waiting) {
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
      kind: "warn",
      message: t("workspace.canvas.run.notifications.waiting", { title: job.title }),
      route: `/pipelines/jobs/${job.id}`,
    });
  }, [addNotification, job, notificationPrefs.waiting, t]);

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
          if (message.startsWith(LLM_CONTENT_PREFIX)) {
            const parts = splitNodeIdPayload(message.slice(LLM_CONTENT_PREFIX.length));
            if (parts) applyNodeLlmContent(parts.nodeId, parts.payload);
          } else if (message.startsWith(NODE_ARTIFACT_PREFIX)) {
            const parts = splitNodeIdPayload(message.slice(NODE_ARTIFACT_PREFIX.length));
            if (parts) {
              const parsed = NodeArtifactSchema.safeParse(
                safeJsonParse(parts.payload).unwrapOr(null),
              );
              if (parsed.success) applyNodeArtifact(parts.nodeId, parsed.data);
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
    setRunTraces(traces.map(toJobTrace));
    // The traces array identity changes per poll; mapping is cheap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setRunTraces, traces.length, activeJobId]);
};

export const RunPoller = () => {
  useRunPolling();

  return null;
};

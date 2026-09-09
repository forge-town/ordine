import { useEffect, useRef, useState, type MouseEvent } from "react";
import { useCreate, useList, useOne } from "@refinedev/core";
import { ResultAsync } from "neverthrow";
import type { ExecutionEvent, ExecutionJob, ExecutionJobResult } from "@repo/schemas";
import { Button } from "@repo/ui/button";
import { jobLabels, terminalStates } from "../../pages/ExecutionWorkspacePage/useJobData";
import { ExecutionArtifactButton } from "./ExecutionArtifactButton";
import { advanceCheckpointProgress, type CheckpointProgress } from "./checkpointProgress";

export const ExecutionJobCard = ({
  jobId,
  onJob,
  onEvents,
}: {
  jobId: string;
  onJob?: (job: ExecutionJob) => void;
  onEvents?: (events: ExecutionEvent[]) => void;
}) => {
  const job = useOne<ExecutionJob>({
    dataProviderName: "execution",
    resource: "jobs",
    id: jobId,
    queryOptions: {
      retry: false,
      refetchInterval: (query) =>
        terminalStates.includes(query.state.data?.data.state ?? "") ? false : 1500,
    },
  });
  const result = useOne<ExecutionJobResult>({
    dataProviderName: "execution",
    resource: "job-results",
    id: jobId,
    queryOptions: {
      retry: false,
      refetchInterval: (query) =>
        terminalStates.includes(query.state.data?.data.state ?? "") ? false : 1500,
    },
  });
  const { mutateAsync } = useCreate<ExecutionJob>({ mutationOptions: { retry: false } });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controlLock = useRef(false);
  const [progress, setProgress] = useState({ cursor: 0, nodes: {} as CheckpointProgress });
  const events = useList<ExecutionEvent>({
    dataProviderName: "execution",
    resource: "job-events",
    meta: { jobId, afterSequence: progress.cursor },
    pagination: { mode: "off" },
    queryOptions: {
      retry: false,
      refetchInterval: terminalStates.includes(job.result?.state ?? "") ? false : 1500,
    },
  });
  useEffect(() => {
    const page = events.result.data;
    if (page.length === 0) return;
    onEvents?.(page.filter((event) => event.jobId === jobId));
    const cursor = Math.max(...page.map((event) => event.sequence));
    setProgress((current) =>
      cursor <= current.cursor
        ? current
        : {
            cursor,
            nodes: advanceCheckpointProgress(
              current.nodes,
              page.filter((event) => event.jobId === jobId),
            ),
          },
    );
  }, [events.result?.data, jobId, onEvents]);
  useEffect(() => {
    if (job.result) onJob?.(job.result);
  }, [job.result, onJob]);
  const refetchEvents = events.query.refetch;
  useEffect(() => {
    if (terminalStates.includes(job.result?.state ?? "")) void refetchEvents();
  }, [job.result?.state, refetchEvents]);
  const handleControl = async (action: "pause" | "resume" | "cancel") => {
    if (controlLock.current) return;
    controlLock.current = true;
    setBusy(true);
    const response = await ResultAsync.fromPromise(
      mutateAsync({
        dataProviderName: "execution",
        resource: "job-control",
        values: { jobId, action },
      }),
      (cause) => (cause instanceof Error ? cause.message : "运行控制失败"),
    );
    setBusy(false);
    controlLock.current = false;
    setError(response.isErr() ? response.error : null);
    void job.query.refetch();
  };
  const state = job.result?.state;
  const handlePause = () => void handleControl("pause");
  const handleResume = () => void handleControl("resume");
  const handleCancel = () => void handleControl("cancel");
  const handleCheckpoint = (event: MouseEvent<HTMLButtonElement>) =>
    void handleAcknowledge(event.currentTarget.value);
  const handleAcknowledge = async (nodeId: string) => {
    if (controlLock.current || state !== "waiting_for_input") return;
    controlLock.current = true;
    setBusy(true);
    const response = await ResultAsync.fromPromise(
      mutateAsync({
        dataProviderName: "execution",
        resource: "checkpoint-ack",
        values: { jobId, nodeId },
      }),
      () => "确认结果暂时无法确定，请刷新当前运行。",
    );
    controlLock.current = false;
    setBusy(false);
    setError(response.isErr() ? response.error : null);
    if (response.isOk())
      setProgress((current) => ({
        ...current,
        nodes: {
          ...current.nodes,
          [nodeId]: {
            state: current.nodes[nodeId]?.state ?? "waiting_for_input",
            acknowledged: true,
          },
        },
      }));
    void job.query.refetch();
    void events.query.refetch();
  };
  const checkpoints = Object.entries(progress.nodes).filter(
    ([, node]) => node.state === "waiting_for_input" && !node.acknowledged,
  );
  const artifacts =
    result.result?.artifacts.filter((artifact) => artifact.state === "published") ?? [];

  return (
    <article
      className="space-y-3 rounded-xl border border-border bg-background p-3 text-xs"
      data-testid="execution-job-card"
    >
      <p className="font-medium" role="status">
        {state ? jobLabels[state] : "读取运行状态…"}
      </p>
      {(job.query.error || result.query.error || error || job.result?.error) && (
        <p className="text-destructive" role="alert">
          {error ??
            job.query.error?.message ??
            result.query.error?.message ??
            job.result?.error?.message}
        </p>
      )}
      {state && !terminalStates.includes(state) && (
        <div className="flex gap-2">
          {state === "running" && (
            <Button disabled={busy} size="sm" variant="outline" onClick={handlePause}>
              暂停
            </Button>
          )}
          {state === "paused" && (
            <Button disabled={busy} size="sm" variant="outline" onClick={handleResume}>
              继续
            </Button>
          )}
          <Button
            disabled={busy || state === "cancelling"}
            size="sm"
            variant="outline"
            onClick={handleCancel}
          >
            {state === "cancelling" ? "正在停止…" : "停止"}
          </Button>
        </div>
      )}
      {events.query.error && <p role="alert">无法读取节点进度，请刷新当前运行。</p>}
      {state === "waiting_for_input" &&
        checkpoints.map(([nodeId]) => (
          <Button
            key={nodeId}
            disabled={busy || events.result.data.length >= 1000}
            size="sm"
            value={nodeId}
            variant="outline"
            onClick={handleCheckpoint}
          >
            确认继续 · {nodeId}
          </Button>
        ))}
      {Object.keys(progress.nodes).length > 0 && (
        <details>
          <summary>节点进度</summary>
          <ul className="mt-2 space-y-1">
            {Object.entries(progress.nodes).map(([nodeId, node]) => (
              <li key={nodeId} className="break-all">
                {nodeId} · {node.state}
              </li>
            ))}
          </ul>
        </details>
      )}
      {artifacts.map((artifact) => (
        <ExecutionArtifactButton key={artifact.artifactId} artifact={artifact} />
      ))}
      {state === "succeeded" && artifacts.length === 0 && (
        <p className="text-muted-foreground">运行成功，未发布文件。</p>
      )}
      {result.result?.outputs && (
        <details>
          <summary className="cursor-pointer">查看输出内容</summary>
          <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words">
            {JSON.stringify(result.result.outputs, null, 2)}
          </pre>
        </details>
      )}
      <details>
        <summary className="cursor-pointer text-muted-foreground">运行标识</summary>
        <p className="mt-1 break-all">{jobId}</p>
      </details>
    </article>
  );
};

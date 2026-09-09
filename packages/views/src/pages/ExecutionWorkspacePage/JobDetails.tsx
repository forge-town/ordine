import { useState } from "react";
import { useCreate, useList } from "@refinedev/core";
import { Card } from "@repo/ui/card";
import { Button } from "@repo/ui/button";
import type { ExecutionEvent, ExecutionJob } from "@repo/schemas";
import { useJobData, jobLabels, terminalStates } from "./useJobData";
import { useWorkspaceData } from "./useWorkspaceData";
import { ArtifactList } from "./ArtifactList";
import { ChoiceField } from "./ChoiceField";
import { mergeExecutionEvents } from "../../execution/events";
export const JobDetails = () => {
  const { jobId, job, result, live } = useJobData();
  const { act, busy } = useWorkspaceData();
  const { mutateAsync } = useCreate<ExecutionJob>({ mutationOptions: { retry: false } });
  const [cursor, setCursor] = useState(0);
  const [previousEvents, setPreviousEvents] = useState<ExecutionEvent[]>([]);
  const [checkpoint, setCheckpoint] = useState("none");
  const eventsQuery = useList<ExecutionEvent>({
    resource: "job-events",
    meta: { jobId, afterSequence: cursor, revision: job.result?.revision },
    pagination: { mode: "off" },
    queryOptions: { enabled: Boolean(jobId), retry: false, refetchInterval: live ? 1500 : false },
  });
  const events = mergeExecutionEvents(jobId, previousEvents, eventsQuery.result.data);
  const nodeStates = new Map<string, string>();
  const attempts = new Map<string, ExecutionEvent>();
  for (const event of events) {
    if (event.nodeId && typeof event.payload.state === "string")
      nodeStates.set(event.nodeId, event.payload.state);
    if (event.attemptId) attempts.set(event.attemptId, event);
  }
  const waiting = [...nodeStates]
    .filter(([, state]) => state === "waiting_for_input")
    .map(([id]) => id);
  const refresh = () => {
    void job.query.refetch();
    void result.query.refetch();
    void eventsQuery.query.refetch();
  };
  if (job.query.isLoading)
    return (
      <Card className="p-5" role="status" variant="surface">
        读取 Job…
      </Card>
    );
  const handleClick1: NonNullable<React.ComponentProps<typeof Button>["onClick"]> = refresh;
  if (job.query.error || !job.result)
    return (
      <Card className="p-5" variant="surface">
        <p className="text-destructive" role="alert">
          {job.query.error?.message ?? "Job 不可用"}
        </p>
        <Button variant="outline" onClick={handleClick1}>
          重试
        </Button>
      </Card>
    );
  const current = job.result;
  const handleClick2: NonNullable<React.ComponentProps<typeof Button>["onClick"]> = () =>
    void act(
      "暂停 Job",
      () => mutateAsync({ resource: "job-control", values: { jobId, action: "pause" } }),
      refresh,
    );
  const handleClick3: NonNullable<React.ComponentProps<typeof Button>["onClick"]> = () =>
    void act(
      "恢复 Job",
      () => mutateAsync({ resource: "job-control", values: { jobId, action: "resume" } }),
      refresh,
    );
  const handleClick4: NonNullable<React.ComponentProps<typeof Button>["onClick"]> = () =>
    void act(
      "取消 Job",
      () => mutateAsync({ resource: "job-control", values: { jobId, action: "cancel" } }),
      refresh,
    );
  const handleClick5: NonNullable<React.ComponentProps<typeof Button>["onClick"]> = refresh;
  const handleChange6: NonNullable<React.ComponentProps<typeof ChoiceField>["onChange"]> =
    setCheckpoint;
  const handleClick7: NonNullable<React.ComponentProps<typeof Button>["onClick"]> = () =>
    void act(
      "确认 Checkpoint",
      () =>
        mutateAsync({
          resource: "checkpoint-ack",
          values: { jobId, nodeId: checkpoint },
        }),
      refresh,
    );
  const handleClick8: NonNullable<React.ComponentProps<typeof Button>["onClick"]> = () => {
    setPreviousEvents(events);
    setCursor(events.at(-1)?.sequence ?? cursor);
  };

  return (
    <div className="space-y-5">
      <Card className="space-y-4 p-5" variant="surface">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{jobLabels[current.state]}</h2>
            <p className="break-all text-xs text-muted-foreground">
              Job {current.id} · revision {current.revision}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy || !["queued", "running"].includes(current.state)}
              size="sm"
              variant="outline"
              onClick={handleClick2}
            >
              暂停
            </Button>
            <Button
              disabled={busy || current.state !== "paused"}
              size="sm"
              variant="outline"
              onClick={handleClick3}
            >
              恢复
            </Button>
            <Button
              disabled={
                busy || terminalStates.includes(current.state) || current.state === "cancelling"
              }
              size="sm"
              variant="outline"
              onClick={handleClick4}
            >
              取消
            </Button>
            <Button size="sm" variant="ghost" onClick={handleClick5}>
              刷新
            </Button>
          </div>
        </div>
        <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
          <p>创建 {new Date(current.createdAt).toLocaleString()}</p>
          <p>
            开始 {current.startedAt ? new Date(current.startedAt).toLocaleString() : "尚未开始"}
          </p>
          <p>
            结束 {current.finishedAt ? new Date(current.finishedAt).toLocaleString() : "尚未结束"}
          </p>
        </div>
        {current.error && (
          <div className="rounded-lg bg-surface-2 p-3 text-sm text-destructive" role="alert">
            <strong>{current.error.code}</strong>
            <p>{current.error.message}</p>
            <p className="text-xs">
              {current.error.stage} · {current.error.nodeId ?? "Job"}
            </p>
          </div>
        )}
        {[...current.warnings, ...(result.result?.warnings ?? [])]
          .filter((warning, index, all) => all.indexOf(warning) === index)
          .map((warning, index) => (
            <p key={index} className="text-sm text-muted-foreground">
              警告：{warning}
            </p>
          ))}
        {current.state === "waiting_for_input" && (
          <div className="space-y-3 rounded-lg bg-surface-2 p-3">
            <h3 className="font-medium">等待执行检查点确认</h3>
            <p className="text-xs text-muted-foreground">
              这是运行过程中的确认，与 RunRequest 用户审批分别处理。
            </p>
            <ChoiceField
              label="等待确认的节点"
              options={[
                {
                  value: "none",
                  label: waiting.length > 0 ? "选择检查点节点" : "等待节点事件，请刷新",
                },
                ...waiting.map((id) => ({ value: id, label: id })),
              ]}
              value={checkpoint}
              onChange={handleChange6}
            />
            <Button disabled={busy || !waiting.includes(checkpoint)} onClick={handleClick7}>
              确认此检查点
            </Button>
          </div>
        )}
      </Card>
      <Card className="space-y-3 p-5" variant="surface">
        <h3 className="font-semibold">实际输出</h3>
        {result.query.error && (
          <p className="text-sm text-destructive" role="alert">
            结果读取失败：{result.query.error.message}
          </p>
        )}
        {!result.result?.outputs && <p className="text-sm text-muted-foreground">尚无最终输出。</p>}
        {Object.entries(result.result?.outputs ?? {}).map(([port, values]) => (
          <div key={port} className="space-y-2 rounded-lg bg-surface-2 p-3">
            <p className="font-medium">{port}</p>
            {values.map((value, index) => (
              <pre
                key={index}
                className="max-h-72 overflow-auto whitespace-pre-wrap break-words text-sm"
              >
                {value.kind === "text"
                  ? value.value
                  : value.kind === "artifact"
                    ? `Artifact ${value.artifactId}`
                    : JSON.stringify(value.value, null, 2)}
              </pre>
            ))}
          </div>
        ))}
      </Card>
      <ArtifactList />
      <Card className="space-y-4 p-5" variant="surface">
        <h3 className="font-semibold">Node Attempts 与运行时事件</h3>
        <div className="flex flex-wrap gap-2">
          {[...attempts].map(([id, event]) => (
            <span key={id} className="rounded-lg bg-surface-2 px-3 py-2 text-xs">
              {event.nodeId} · Attempt {id.slice(0, 12)}… · {event.type}
            </span>
          ))}
        </div>
        {eventsQuery.query.error && (
          <p className="text-sm text-destructive" role="alert">
            事件读取失败：{eventsQuery.query.error.message}
          </p>
        )}
        {events.length === 0 && <p className="text-sm text-muted-foreground">尚无持久化事件。</p>}
        <div className="max-h-96 space-y-2 overflow-auto">
          {events.map((event) => (
            <details key={event.sequence} className="rounded-lg bg-surface-2 p-3">
              <summary className="cursor-pointer break-all text-xs">
                #{event.sequence} · {new Date(event.createdAt).toLocaleTimeString()} · {event.type}{" "}
                · {event.nodeId ?? "Job"}
              </summary>
              <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words text-xs">
                {JSON.stringify(event.payload, null, 2)}
              </pre>
            </details>
          ))}
        </div>
        {eventsQuery.result.data.length >= 1000 && (
          <Button variant="outline" onClick={handleClick8}>
            加载后续事件
          </Button>
        )}
      </Card>
    </div>
  );
};

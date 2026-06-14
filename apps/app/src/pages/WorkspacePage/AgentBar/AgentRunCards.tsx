import { useOne } from "@refinedev/core";
import { useNavigate } from "@tanstack/react-router";
import { ResultAsync } from "neverthrow";
import { useEffect, useState } from "react";
import type { Job, JobTrace } from "@repo/schemas";
import { ResourceName, dataProvider } from "@/integrations/refine/dataProvider";
import { useCanvasStore } from "../canvas/_store/canvasStore";
import { CheckpointCard, ErrorCard, RunStatusCard, SelfHealCard } from "./messages";
import { buildAgentRunSummary, buildSelfHealSteps } from "./runSummary";

const POLL_INTERVAL = 1500;

const isTerminalStatus = (status: Job["status"]) =>
  status === "done" || status === "failed" || status === "cancelled" || status === "expired";

export const AgentRunCards = () => {
  const navigate = useNavigate();
  const activeJobId = useCanvasStore((state) => state.activeJobId);
  const nodes = useCanvasStore((state) => state.nodes);
  const storeNodeStatuses = useCanvasStore((state) => state.nodeRunStatuses);
  const setConfigNodeId = useCanvasStore((state) => state.setConfigNodeId);
  const [isControlPending, setIsControlPending] = useState(false);
  const [selfHealSteps, setSelfHealSteps] = useState<
    { label: string; tone?: "muted" | "success" }[]
  >([]);
  const { query: jobQuery } = useOne<Job>({
    resource: ResourceName.jobs,
    id: activeJobId ?? "",
    queryOptions: {
      enabled: !!activeJobId,
      refetchInterval: (query) => {
        const status = (query.state.data?.data as Job | undefined)?.status;
        if (status && isTerminalStatus(status)) return false;

        return POLL_INTERVAL;
      },
    },
  });
  const job = (jobQuery.data?.data as Job | undefined) ?? null;
  const nodeStatuses = job?.nodeStatuses ?? storeNodeStatuses ?? {};
  const summary = buildAgentRunSummary({ job, nodeStatuses, nodes });
  const waitingNode = nodes.find((node) => nodeStatuses[node.id] === "waitingForUser");
  const handleCheckpointReview = () => waitingNode && setConfigNodeId(waitingNode.id);
  const canControl = Boolean(activeJobId && summary.isLive);

  useEffect(() => {
    const shouldLoadTraces =
      Boolean(activeJobId) &&
      (job?.status === "failed" || Object.values(nodeStatuses).includes("retrying"));
    if (!activeJobId || !shouldLoadTraces) {
      setSelfHealSteps([]);

      return;
    }

    const state = { cancelled: false };
    void (async () => {
      const result = await ResultAsync.fromPromise(
        dataProvider.custom!<{ traces: JobTrace[] }>({
          method: "get",
          payload: { jobId: activeJobId },
          url: "jobs/traces",
        }),
        () => null,
      );
      if (result.isOk() && !state.cancelled) {
        setSelfHealSteps(buildSelfHealSteps(result.value.data.traces ?? []));
      }
    })();

    return () => {
      state.cancelled = true;
    };
  }, [activeJobId, job?.status, job?.meta?.updatedAt, nodeStatuses]);

  const runControlAction = async (action: "pause" | "resume") => {
    if (!activeJobId || isControlPending) {
      return;
    }

    setIsControlPending(true);
    const result = await ResultAsync.fromPromise(
      dataProvider.custom!({
        method: "post",
        payload: { jobId: activeJobId },
        url: `jobs/${action}`,
      }),
      () => null,
    );
    setIsControlPending(false);

    if (result.isOk()) {
      await jobQuery.refetch();
    }
  };

  const handlePause = () => {
    void runControlAction("pause");
  };

  const handleResume = () => {
    void runControlAction("resume");
  };

  return (
    <>
      <RunStatusCard
        costLabel={summary.costLabel}
        isLive={summary.isLive}
        subtitle={summary.subtitle}
        title={summary.title}
      />
      {canControl ? (
        <CheckpointCard
          isWaiting={Boolean(waitingNode)}
          nodeLabel={waitingNode?.data.label}
          onPause={handlePause}
          onResume={handleResume}
          onReview={handleCheckpointReview}
        />
      ) : null}
      {selfHealSteps.length > 0 ? (
        <SelfHealCard
          open={Boolean(summary.failedError)}
          steps={selfHealSteps}
          subtitle={`${selfHealSteps.length} recovery trace${selfHealSteps.length > 1 ? "s" : ""}`}
          title="Self-heal"
        />
      ) : null}
      {summary.failedError ? (
        <ErrorCard
          {...summary.failedError}
          onAction={
            /connector/i.test(summary.failedError.tryLabel)
              ? () => void navigate({ to: "/connectors" })
              : undefined
          }
        />
      ) : null}
    </>
  );
};

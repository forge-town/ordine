import { useOne } from "@refinedev/core";
import { ResultAsync } from "neverthrow";
import { useState } from "react";
import { useStore } from "zustand";
import type { Job } from "@repo/schemas";
import { ResourceName, dataProvider } from "@/integrations/refine/dataProvider";
import { useCanvasPageStore } from "@/pages/CanvasPage/_store";
import { CheckpointCard, ErrorCard, RunStatusCard } from "./messages";
import { buildAgentRunSummary } from "./runSummary";

const POLL_INTERVAL = 1500;

const isTerminalStatus = (status: Job["status"]) =>
  status === "done" || status === "failed" || status === "cancelled" || status === "expired";

export const AgentRunCards = () => {
  const store = useCanvasPageStore();
  const activeJobId = useStore(store, (state) => state.activeJobId);
  const nodes = useStore(store, (state) => state.nodes);
  const storeNodeStatuses = useStore(store, (state) => state.nodeRunStatuses);
  const [isControlPending, setIsControlPending] = useState(false);
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
  const canControl = Boolean(activeJobId && summary.isLive);

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
        />
      ) : null}
      {summary.failedError ? <ErrorCard {...summary.failedError} /> : null}
    </>
  );
};

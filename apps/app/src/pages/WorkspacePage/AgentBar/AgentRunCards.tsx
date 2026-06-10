import { useOne } from "@refinedev/core";
import { useStore } from "zustand";
import type { Job } from "@repo/schemas";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { useCanvasPageStore } from "@/pages/CanvasPage/_store";
import { ErrorCard, RunStatusCard } from "./messages";
import { buildAgentRunSummary } from "./runSummary";

const POLL_INTERVAL = 1500;

const isTerminalStatus = (status: Job["status"]) =>
  status === "done" || status === "failed" || status === "cancelled" || status === "expired";

export const AgentRunCards = () => {
  const store = useCanvasPageStore();
  const activeJobId = useStore(store, (state) => state.activeJobId);
  const nodes = useStore(store, (state) => state.nodes);
  const storeNodeStatuses = useStore(store, (state) => state.nodeRunStatuses);
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
  const nodeStatuses = job?.nodeStatuses ?? storeNodeStatuses;
  const summary = buildAgentRunSummary({ job, nodeStatuses, nodes });

  return (
    <>
      <RunStatusCard
        costLabel={summary.costLabel}
        isLive={summary.isLive}
        subtitle={summary.subtitle}
        title={summary.title}
      />
      {summary.failedError ? <ErrorCard {...summary.failedError} /> : null}
    </>
  );
};

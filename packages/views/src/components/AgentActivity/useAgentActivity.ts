import { useEffect, useMemo } from "react";
import { useStore } from "zustand";
import type { AgentRunEventsTransport } from "../../lib/agentRunEventsClient";
import {
  acquireAgentActivity,
  getAgentActivityEntry,
  selectAgentActivityViewModel,
} from "./agentActivityStore";

export const useAgentActivity = ({
  runId,
  platform,
}: {
  runId: string | null | undefined;
  platform: AgentRunEventsTransport;
}) => {
  const entry = useMemo(
    () => (runId ? getAgentActivityEntry(runId, platform) : null),
    [platform, runId],
  );
  useEffect(() => {
    if (!entry) return;

    return acquireAgentActivity(entry);
  }, [entry]);

  const viewModel = useStore(
    entry?.store ?? getAgentActivityEntry("__empty__", platform).store,
    selectAgentActivityViewModel,
  );

  return entry ? viewModel : { ...viewModel, runId: null };
};

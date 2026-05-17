import { Bot, Clock } from "lucide-react";
import { useCustom } from "@refinedev/core";
import type { AgentRawExport } from "@repo/schemas";
import { AgentRunCard } from "./AgentRunCard";

interface AgentRunsPanelProps {
  jobId: string;
}

export const AgentRunsPanel = ({ jobId }: AgentRunsPanelProps) => {
  const { result, query } = useCustom<{ agentRuns: AgentRawExport[] }>({
    url: "jobs/agentRuns",
    method: "get",
    config: { payload: { jobId } },
    queryOptions: { enabled: !!jobId },
  });
  const runs = result.data?.agentRuns ?? [];

  if (query.isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-2.5">
          <Bot className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground">Agent Runs</span>
        </div>
        <div className="flex flex-col items-center justify-center py-10">
          <Clock className="h-8 w-8 animate-spin text-muted-foreground/30" />
          <p className="mt-2 text-xs text-muted-foreground">Loading agent runs…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-2.5">
        <Bot className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground">Agent Runs</span>
        <span className="ml-auto text-[11px] text-muted-foreground">{runs.length}</span>
      </div>
      {runs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Bot className="h-8 w-8 text-muted-foreground/30" />
          <p className="mt-2 text-xs text-muted-foreground">No agent runs recorded</p>
        </div>
      ) : (
        <div className="p-3 space-y-2">
          {runs.map((run) => (
            <AgentRunCard key={run.id} run={run} />
          ))}
        </div>
      )}
    </div>
  );
};

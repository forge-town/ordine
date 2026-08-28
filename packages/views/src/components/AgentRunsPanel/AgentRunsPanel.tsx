import { Bot, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCustom } from "@refinedev/core";
import type { AgentRawExport } from "@repo/schemas";
import { surfaceCardVariants } from "@repo/ui/card";
import { cn } from "@repo/ui/lib/utils";
import { AgentActivitySurface } from "../AgentActivity";
import { usePlatform } from "../../platform";
import { AgentRunCard } from "./AgentRunCard";

interface AgentRunsPanelProps {
  jobId: string;
  activityRunIds?: readonly string[];
}

export const AgentRunsPanel = ({ activityRunIds = [], jobId }: AgentRunsPanelProps) => {
  const { t } = useTranslation();
  const platform = usePlatform();
  const { result, query } = useCustom<{ agentRuns: AgentRawExport[] }>({
    url: "jobs/agentRuns",
    method: "get",
    config: { payload: { jobId } },
    queryOptions: { enabled: !!jobId },
  });
  const runs = result.data?.agentRuns ?? [];

  if (query.isLoading) {
    return (
      <div className={cn(surfaceCardVariants(), "overflow-hidden")}>
        <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-2.5">
          <Bot className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground">
            {t("jobs.agentRuns.title")}
          </span>
        </div>
        <div className="flex flex-col items-center justify-center py-10">
          <Clock className="h-8 w-8 animate-spin text-muted-foreground/30" />
          <p className="mt-2 text-xs text-muted-foreground">{t("jobs.agentRuns.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(surfaceCardVariants(), "overflow-hidden")}>
      <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-2.5">
        <Bot className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground">
          {t("jobs.agentRuns.title")}
        </span>
        <span className="ml-auto text-[11px] text-muted-foreground">{runs.length}</span>
      </div>
      {runs.length === 0 && activityRunIds.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Bot className="h-8 w-8 text-muted-foreground/30" />
          <p className="mt-2 text-xs text-muted-foreground">{t("jobs.agentRuns.empty")}</p>
        </div>
      ) : (
        <div className="p-3 space-y-2">
          {activityRunIds.map((runId) => (
            <AgentActivitySurface key={runId} platform={platform} runId={runId} variant="panel" />
          ))}
          {runs.map((run) => (
            <AgentRunCard key={run.id} jobId={jobId} run={run} />
          ))}
        </div>
      )}
    </div>
  );
};

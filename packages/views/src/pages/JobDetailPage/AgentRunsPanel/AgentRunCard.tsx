import { useState } from "react";
import {
  Bot,
  ChevronDown,
  ChevronRight,
  Clock,
  Coins,
  CheckCircle2,
  XCircle,
  FileJson,
} from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { useCustom } from "@refinedev/core";
import type { AgentRawExport, AgentSpan } from "@repo/schemas";
import { ConversationView } from "./ConversationView";
import { SpanRow } from "./SpanRow";
import { formatDuration, formatTokens } from "./agentRunsHelpers";

interface AgentRunCardProps {
  run: AgentRawExport;
}

export const AgentRunCard = ({ run }: AgentRunCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const [rawExpanded, setRawExpanded] = useState(false);
  const handleToggleRawButtonClick = () => setRawExpanded((prev) => !prev);
  const handleAgentRunCardButtonClick = () => {
    setExpanded((prev) => !prev);
  };
  const { result: spansResult } = useCustom<{ spans: AgentSpan[] }>({
    url: "jobs/agentRunSpans",
    method: "get",
    config: { payload: { rawExportId: run.id } },
    queryOptions: { enabled: expanded },
  });
  const spans = spansResult.data?.spans ?? [];

  const isError = run.status === "error";
  const StatusIcon = isError ? XCircle : CheckCircle2;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <Button
        className="w-full justify-start gap-2 rounded-none border-0 px-4 py-3 h-auto"
        variant="ghost"
        onClick={handleAgentRunCardButtonClick}
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <Bot className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="font-mono text-xs font-medium text-foreground truncate">
          {run.agentId}
        </span>
        <Badge className="h-4 text-[10px]" variant="secondary">
          {run.agentRuntime}
        </Badge>
        {run.modelId && (
          <Badge className="h-4 text-[10px]" variant="outline">
            {run.modelId}
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          {(run.tokenInput !== null || run.tokenOutput !== null) && (
            <span className="flex items-center gap-1">
              <Coins className="h-3 w-3" />
              {formatTokens(run.tokenInput, run.tokenOutput)}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDuration(run.durationMs)}
          </span>
          <StatusIcon
            className={cn("h-3.5 w-3.5", isError ? "text-red-500" : "text-emerald-500")}
          />
        </div>
      </Button>

      {expanded && (
        <div className="border-t border-border">
          {Boolean(run.rawPayload && typeof run.rawPayload === "object") && (
            <ConversationView payload={run.rawPayload as Record<string, unknown>} />
          )}

          {spans.length > 0 && (
            <div className="border-t border-border py-1">
              <div className="px-4 py-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Spans
                </span>
              </div>
              {spans.map((span) => (
                <SpanRow key={span.id} span={span} />
              ))}
            </div>
          )}

          <div className="border-t border-border">
            <Button
              className="w-full justify-start gap-2 rounded-none border-0 px-4 py-2 h-auto text-xs text-muted-foreground"
              variant="ghost"
              onClick={handleToggleRawButtonClick}
            >
              <FileJson className="h-3 w-3" />
              {rawExpanded ? "Hide raw JSON" : "View raw JSON"}
            </Button>
            {rawExpanded && (
              <div className="bg-gray-950 p-4 overflow-x-auto max-h-64 overflow-y-auto">
                <pre className="text-[11px] text-gray-300 font-mono whitespace-pre-wrap break-all">
                  {JSON.stringify(run.rawPayload, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

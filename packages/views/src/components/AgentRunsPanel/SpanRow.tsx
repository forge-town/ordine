import { useState } from "react";
import { ChevronDown, ChevronRight, Clock, Coins, Code2 } from "lucide-react";
import { Button } from "@repo/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { Badge } from "@repo/ui/badge";
import type { AgentSpan } from "@repo/schemas";
import {
  SPAN_STATUS_STYLE,
  SPAN_TYPE_ICON,
  formatDuration,
  formatTokens,
} from "./agentRunsHelpers";

interface SpanRowProps {
  span: AgentSpan;
}

export const SpanRow = ({ span }: SpanRowProps) => {
  const [expanded, setExpanded] = useState(false);
  const handleSpanRowClick = () => setExpanded((p) => !p);
  const Icon = SPAN_TYPE_ICON[span.spanType] ?? Code2;
  const statusStyle = SPAN_STATUS_STYLE[span.status] ?? SPAN_STATUS_STYLE.completed;
  const StatusIcon = statusStyle.icon;
  const hasContent = Boolean(span.input || span.output);

  const displayName = span.name.startsWith("thinking-")
    ? "💭 Thinking"
    : span.name.startsWith("text-")
      ? "💬 Response"
      : span.name;

  const bgClass =
    span.spanType === "tool_call"
      ? "bg-amber-500/5 border-l-2 border-l-amber-500/30"
      : span.spanType === "tool_result"
        ? "bg-blue-500/5 border-l-2 border-l-blue-500/30"
        : span.name.startsWith("thinking-")
          ? "bg-violet-500/5 border-l-2 border-l-violet-500/30"
          : "";

  return (
    <div className={cn("text-xs", bgClass)}>
      <Button
        className="flex h-auto w-full items-center justify-start gap-2 rounded-none px-3 py-2 text-left hover:bg-muted/50"
        disabled={!hasContent}
        type="button"
        variant="ghost"
        onClick={handleSpanRowClick}
      >
        {hasContent ? (
          expanded ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
          )
        ) : (
          <div className="w-3" />
        )}
        <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span className="font-medium text-foreground truncate">{displayName}</span>
        <Badge className="h-4 text-[10px] shrink-0" variant="outline">
          {span.spanType}
        </Badge>
        <StatusIcon className={cn("h-3 w-3 shrink-0", statusStyle.cls)} />
        {span.modelId && <span className="text-[10px] text-muted-foreground">{span.modelId}</span>}
        <div className="ml-auto flex items-center gap-2 text-muted-foreground shrink-0">
          {span.durationMs !== null && (
            <span className="flex items-center gap-0.5">
              <Clock className="h-2.5 w-2.5" />
              {formatDuration(span.durationMs)}
            </span>
          )}
          {(span.tokenInput !== null || span.tokenOutput !== null) && (
            <span className="flex items-center gap-0.5">
              <Coins className="h-2.5 w-2.5" />
              {formatTokens(span.tokenInput, span.tokenOutput)}
            </span>
          )}
        </div>
      </Button>
      {expanded && hasContent && (
        <div className="px-3 pb-2 ml-8">
          {span.input && (
            <div className="rounded border border-border bg-muted/30 p-2 mb-1">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                Input
              </div>
              <pre className="text-[11px] text-foreground/80 font-mono whitespace-pre-wrap wrap-break-word max-h-40 overflow-y-auto">
                {span.input}
              </pre>
            </div>
          )}
          {span.output && (
            <div className="rounded border border-border bg-muted/30 p-2">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                Output
              </div>
              <pre className="text-[11px] text-foreground/80 font-mono whitespace-pre-wrap wrap-break-word max-h-40 overflow-y-auto">
                {span.output}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

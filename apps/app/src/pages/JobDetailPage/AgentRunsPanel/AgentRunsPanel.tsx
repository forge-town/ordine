import { useState } from "react";
import {
  Bot,
  ChevronDown,
  ChevronRight,
  Clock,
  Coins,
  CheckCircle2,
  XCircle,
  Wrench,
  MessageSquare,
  Code2,
  FileJson,
  User,
  Cpu,
  AlertTriangle,
  Copy,
  Check,
} from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { useCustom } from "@refinedev/core";
import type { AgentRawExport, AgentSpan, SpanType, SpanStatus } from "@repo/schemas";
import { Result } from "neverthrow";

/* ── helpers ─────────────────────────────────────────────────────── */

const formatDuration = (ms: number | null): string => {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;

  return `${(ms / 1000).toFixed(2)}s`;
};

const formatTokens = (input: number | null, output: number | null): string => {
  if (input === null && output === null) return "—";

  return `${input ?? 0} → ${output ?? 0}`;
};

const SPAN_TYPE_ICON: Record<SpanType, React.ElementType> = {
  agent_run: Bot,
  llm_call: MessageSquare,
  tool_call: Wrench,
  tool_result: Code2,
};

const SPAN_STATUS_STYLE: Record<SpanStatus, { cls: string; icon: React.ElementType }> = {
  running: { cls: "text-blue-600", icon: Clock },
  completed: { cls: "text-emerald-600", icon: CheckCircle2 },
  error: { cls: "text-red-600", icon: XCircle },
};

/* ── SpanRow ─────────────────────────────────────────────────────── */

const SpanRow = ({ span }: { span: AgentSpan }) => {
  const [expanded, setExpanded] = useState(false);
  const handleToggleSpan = () => setExpanded((p) => !p);
  const Icon = SPAN_TYPE_ICON[span.spanType] ?? Code2;
  const statusStyle = SPAN_STATUS_STYLE[span.status] ?? SPAN_STATUS_STYLE.completed;
  const StatusIcon = statusStyle.icon;
  const hasContent = Boolean(span.input || span.output);

  // Display name mapping for readability
  const displayName = span.name.startsWith("thinking-")
    ? "💭 Thinking"
    : span.name.startsWith("text-")
      ? "💬 Response"
      : span.name;

  // Color coding by span type
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
      <button
        className="flex items-center gap-2 w-full py-2 px-3 hover:bg-muted/50 text-left"
        disabled={!hasContent}
        type="button"
        onClick={handleToggleSpan}
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
      </button>
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

/* ── CopyButton ──────────────────────────────────────────────────── */

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <Button
      className="h-5 w-5 shrink-0 text-muted-foreground hover:text-foreground"
      size="icon"
      variant="ghost"
      onClick={handleCopy}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </Button>
  );
};

/* ── MessageBubble ───────────────────────────────────────────────── */

const MessageBubble = ({
  role,
  content,
  label,
}: {
  role: "system" | "user" | "assistant" | "error";
  content: string;
  label?: string;
}) => {
  const [collapsed, setCollapsed] = useState(content.length > 600);
  const isLong = content.length > 600;
  const handleToggleCollapse = () => setCollapsed((p) => !p);

  const roleConfig = {
    system: { icon: Cpu, bg: "bg-violet-500/10 border-violet-500/20", iconCls: "text-violet-500" },
    user: { icon: User, bg: "bg-blue-500/10 border-blue-500/20", iconCls: "text-blue-500" },
    assistant: {
      icon: Bot,
      bg: "bg-emerald-500/10 border-emerald-500/20",
      iconCls: "text-emerald-500",
    },
    error: { icon: AlertTriangle, bg: "bg-red-500/10 border-red-500/20", iconCls: "text-red-500" },
  };

  const cfg = roleConfig[role];
  const Icon = cfg.icon;
  const displayContent = collapsed ? content.slice(0, 500) + "…" : content;

  return (
    <div className={cn("rounded-lg border p-3", cfg.bg)}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn("h-3.5 w-3.5 shrink-0", cfg.iconCls)} />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label ?? role}
        </span>
        <div className="ml-auto">
          <CopyButton text={content} />
        </div>
      </div>
      <pre className="text-xs text-foreground/90 font-mono whitespace-pre-wrap wrap-break-word leading-relaxed">
        {displayContent}
      </pre>
      {isLong && (
        <Button
          className="mt-1 h-5 text-[10px] px-2 text-muted-foreground"
          variant="ghost"
          onClick={handleToggleCollapse}
        >
          {collapsed ? `Show all (${content.length} chars)` : "Collapse"}
        </Button>
      )}
    </div>
  );
};

/* ── FindingsView — structured findings from check output ────────── */

const FindingsView = ({ output }: { output: string }) => {
  const parsed = Result.fromThrowable(
    () =>
      JSON.parse(output) as {
        summary?: string;
        findings?: Array<{
          id: string;
          severity: string;
          message: string;
          file?: string;
          line?: number;
          suggestion?: string;
        }>;
        stats?: Record<string, number>;
      },
    () => null
  )();
  if (parsed.isErr()) return null;
  const data = parsed.value;
  if (!data?.findings) return null;

  const severityStyle: Record<string, string> = {
    error: "bg-red-500/10 text-red-600 border-red-500/30",
    warning: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    info: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  };

  return (
    <div className="space-y-3">
      {data.summary && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
          <div className="flex items-center gap-2 mb-1">
            <Bot className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Summary
            </span>
          </div>
          <p className="text-xs text-foreground/90 leading-relaxed">{data.summary}</p>
        </div>
      )}
      {data.findings.map((f) => (
        <div
          key={f.id}
          className={cn("rounded-lg border p-3", severityStyle[f.severity] ?? severityStyle.info)}
        >
          <div className="flex items-center gap-2 mb-1">
            <Badge className="h-4 text-[10px]" variant="outline">
              {f.severity}
            </Badge>
            <span className="text-xs font-medium">{f.message}</span>
          </div>
          {f.file && (
            <p className="text-[11px] text-muted-foreground font-mono mt-1">
              {f.file}
              {f.line ? `:${f.line}` : ""}
            </p>
          )}
          {f.suggestion && (
            <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
              💡 {f.suggestion}
            </p>
          )}
        </div>
      ))}
      {data.stats && (
        <div className="flex gap-3 text-[11px] text-muted-foreground px-1">
          {Object.entries(data.stats).map(([k, v]) => (
            <span key={k}>
              {k}: <span className="font-medium text-foreground">{v}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

/* ── ConversationView — renders payload as chat bubbles ──────────── */

const ConversationView = ({ payload }: { payload: Record<string, unknown> }) => (
  <div className="p-3 space-y-2">
    {/* Output / Findings first — most important for the user */}
    {Boolean(payload.output) && <OutputSection output={String(payload.output)} />}
    {Boolean(payload.system) && (
      <MessageBubble content={String(payload.system)} label="System Prompt" role="system" />
    )}
    {Boolean(payload.prompt) && (
      <MessageBubble content={String(payload.prompt)} label="User Input" role="user" />
    )}
  </div>
);

/* ── OutputSection — tries structured view, falls back to bubble ─── */

const OutputSection = ({ output }: { output: string }) => {
  const parsed = Result.fromThrowable(
    () => JSON.parse(output) as { findings?: unknown[] },
    () => null
  )();
  if (parsed.isOk() && parsed.value?.findings) {
    return <FindingsView output={output} />;
  }

  return <MessageBubble content={output} label="Agent Output" role="assistant" />;
};

/* ── AgentRunCard ────────────────────────────────────────────────── */

const AgentRunCard = ({ run }: { run: AgentRawExport }) => {
  const [expanded, setExpanded] = useState(false);
  const [rawExpanded, setRawExpanded] = useState(false);
  const handleToggleRaw = () => setRawExpanded((prev) => !prev);
  const { result: spansResult } = useCustom<{ spans: AgentSpan[] }>({
    url: "jobs/agentRunSpans",
    method: "get",
    config: { payload: { rawExportId: run.id } },
    queryOptions: { enabled: expanded },
  });
  const spans = spansResult.data?.spans ?? [];

  const handleToggle = () => {
    setExpanded((prev) => !prev);
  };

  const isError = run.status === "error";
  const StatusIcon = isError ? XCircle : CheckCircle2;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Run header */}
      <Button
        className="w-full justify-start gap-2 rounded-none border-0 px-4 py-3 h-auto"
        variant="ghost"
        onClick={handleToggle}
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
          {run.agentSystem}
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

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border">
          {/* Conversation view from rawPayload */}
          {Boolean(run.rawPayload && typeof run.rawPayload === "object") && (
            <ConversationView payload={run.rawPayload as Record<string, unknown>} />
          )}

          {/* Span tree */}
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

          {/* Raw payload toggle */}
          <div className="border-t border-border">
            <Button
              className="w-full justify-start gap-2 rounded-none border-0 px-4 py-2 h-auto text-xs text-muted-foreground"
              variant="ghost"
              onClick={handleToggleRaw}
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

/* ── AgentRunsPanel ──────────────────────────────────────────────── */

export const AgentRunsPanel = ({ jobId }: { jobId: string }) => {
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

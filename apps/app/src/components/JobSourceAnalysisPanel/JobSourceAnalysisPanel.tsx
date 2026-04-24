import { useMemo } from "react";
import { useCustom, useOne } from "@refinedev/core";
import { Bot, Clock3, Terminal, Wrench } from "lucide-react";
import type { AgentRawExport, AgentSpan, Job, JobTrace } from "@repo/schemas";
import { Badge } from "@repo/ui/badge";
import { Card } from "@repo/ui/card";
import { PageLoadingState } from "@/components/PageLoadingState";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { AgentRunsPanel } from "@/pages/JobDetailPage/AgentRunsPanel";

const EMPTY_TRACES: JobTrace[] = [];
const EMPTY_AGENT_RUNS: AgentRawExport[] = [];
const EMPTY_SPANS_BY_RUN: Record<number, AgentSpan[]> = {};

type JobSourceAnalysisPanelProps = {
  jobId: string;
};

type TimelineEvent = {
  key: string;
  type: "trace" | "agent";
  label: string;
  description: string;
  createdAt: Date;
};

type JobAnalysisData = {
  traces: JobTrace[];
  agentRuns: AgentRawExport[];
  spansByRun: Record<number, AgentSpan[]>;
};

const formatDuration = (startedAt?: Date | null, finishedAt?: Date | null) => {
  if (!startedAt || !finishedAt) {
    return "—";
  }

  const durationMs = finishedAt.getTime() - startedAt.getTime();
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  return `${(durationMs / 1000).toFixed(2)}s`;
};

export const JobSourceAnalysisPanel = ({ jobId }: JobSourceAnalysisPanelProps) => {
  const { result: jobResult, query: jobQuery } = useOne<Job>({
    resource: ResourceName.jobs,
    id: jobId,
  });
  const { result: analysisResult, query: analysisQuery } = useCustom<JobAnalysisData>({
    url: "jobs/analysis",
    method: "get",
    config: {
      payload: { jobId },
    },
    queryOptions: {
      enabled: !!jobId,
    },
  });
  const job = jobResult ?? null;
  const traces = analysisResult.data?.traces ?? EMPTY_TRACES;
  const agentRuns = analysisResult.data?.agentRuns ?? EMPTY_AGENT_RUNS;
  const spansByRun = analysisResult.data?.spansByRun ?? EMPTY_SPANS_BY_RUN;

  const stats = useMemo(() => {
    const allSpans = Object.values(spansByRun).flat();
    const toolCalls = allSpans.filter((span) => span.spanType === "tool_call").length;
    const llmCalls = allSpans.filter((span) => span.spanType === "llm_call").length;
    const totalTokens = agentRuns.reduce(
      (totals, run) => ({
        input: totals.input + (run.tokenInput ?? 0),
        output: totals.output + (run.tokenOutput ?? 0),
      }),
      { input: 0, output: 0 }
    );

    return {
      traceCount: traces.length,
      agentRunCount: agentRuns.length,
      toolCalls,
      llmCalls,
      totalTokens,
    };
  }, [agentRuns, spansByRun, traces.length]);

  const timeline = useMemo(() => {
    const traceEvents: TimelineEvent[] = traces.map((trace) => ({
      key: `trace-${trace.id}`,
      type: "trace",
      label: trace.level,
      description: trace.message,
      createdAt: trace.createdAt,
    }));
    const agentEvents: TimelineEvent[] = agentRuns.map((run) => ({
      key: `agent-${run.id}`,
      type: "agent",
      label: run.agentId,
      description: `${run.agentSystem}${run.modelId ? ` · ${run.modelId}` : ""}`,
      createdAt: run.createdAt,
    }));

    return [...traceEvents, ...agentEvents]
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
      .slice(-24);
  }, [agentRuns, traces]);

  if (jobQuery?.isLoading || analysisQuery?.isLoading) {
    return <PageLoadingState variant="detail" />;
  }

  if (!job) {
    return (
      <Card className="p-5">
        <p className="text-sm text-muted-foreground">Job source not found.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Job Source Analysis</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Frontend breakdown of the job timeline, agent runs, and tool activity.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{job.status}</Badge>
            <Badge variant="outline">{job.type}</Badge>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-border/60 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Terminal className="h-3.5 w-3.5" />
              Traces
            </div>
            <div className="mt-2 text-lg font-semibold text-foreground">{stats.traceCount}</div>
          </div>
          <div className="rounded-lg border border-border/60 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Bot className="h-3.5 w-3.5" />
              Agent Runs
            </div>
            <div className="mt-2 text-lg font-semibold text-foreground">{stats.agentRunCount}</div>
          </div>
          <div className="rounded-lg border border-border/60 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Wrench className="h-3.5 w-3.5" />
              Tool Calls
            </div>
            <div className="mt-2 text-lg font-semibold text-foreground">{stats.toolCalls}</div>
          </div>
          <div className="rounded-lg border border-border/60 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock3 className="h-3.5 w-3.5" />
              Duration
            </div>
            <div className="mt-2 text-lg font-semibold text-foreground">
              {formatDuration(job.startedAt, job.finishedAt)}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-border/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Timeline
            </div>
            <div className="text-xs text-muted-foreground">
              LLM calls: {stats.llmCalls} · Tokens: {stats.totalTokens.input} →{" "}
              {stats.totalTokens.output}
            </div>
          </div>
          <div className="mt-3 space-y-3">
            {timeline.length > 0 ? (
              timeline.map((item) => (
                <div
                  key={item.key}
                  className="flex items-start gap-3 rounded-lg border border-border/50 px-3 py-2"
                >
                  <Badge variant={item.type === "agent" ? "secondary" : "outline"}>
                    {item.type}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{item.label}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {item.createdAt.toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No timeline events available.</p>
            )}
          </div>
        </div>
      </Card>

      <AgentRunsPanel jobId={jobId} />
    </div>
  );
};

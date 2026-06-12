import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Calendar, Gauge, Info } from "lucide-react";
import { useCustom, useList } from "@refinedev/core";
import type { PipelineData } from "@repo/schemas";
import { Button } from "@repo/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/dropdown-menu";
import { PageHeader } from "@/components/PageHeader";
import { formatCost as formatCostShared } from "@/lib/format";
import { PageLoadingState } from "@/components/PageLoadingState";
import { BarRow, Icon, Stat } from "@/components/primitives";
import { ResourceName } from "@/integrations/refine/dataProvider";

const RANGE_OPTIONS = ["Today", "This week", "This month", "This quarter", "All time"] as const;
type UsageRange = (typeof RANGE_OPTIONS)[number];

type UsageSummary = {
  avgCostPerRun: number;
  runCount: number;
  totalCost: number;
  totalTokens: number;
};

type UsageDailyCost = {
  cost: number;
  date: string;
  tokens: number;
};

type UsageByPipeline = {
  pipelineId: string | null;
  runCount: number;
  totalCost: number;
  totalTokens: number;
};

type UsageByAgent = {
  agentId: string;
  agentRuntime: string;
  modelId: string | null;
  runCount: number;
  tokens: number;
};

const EMPTY_SUMMARY: UsageSummary = {
  avgCostPerRun: 0,
  runCount: 0,
  totalCost: 0,
  totalTokens: 0,
};

const getStartOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const getRangeDates = (range: UsageRange) => {
  const to = new Date();
  const today = getStartOfDay(to);

  if (range === "Today") return { from: today, to };
  if (range === "This week") {
    const day = today.getDay();
    const offset = day === 0 ? 6 : day - 1;

    return { from: new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset), to };
  }
  if (range === "This month") {
    return { from: new Date(today.getFullYear(), today.getMonth(), 1), to };
  }
  if (range === "This quarter") {
    const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3;

    return { from: new Date(today.getFullYear(), quarterStartMonth, 1), to };
  }

  return { from: new Date(2000, 0, 1), to };
};

const formatTokens = (value: number) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1000) return `${Math.round(value / 1000)}k`;

  return String(Math.round(value));
};

const formatCost = (value: number) => formatCostShared(value) ?? "$0.00";

const getPct = (value: number, max: number) => (max > 0 ? Math.round((value / max) * 100) : 0);

const getArrayData = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "object" && value !== null && "data" in value && Array.isArray(value.data)) {
    return value.data as T[];
  }

  return [];
};

const getObjectData = <T extends object>(value: unknown, fallback: T): T => {
  if (typeof value === "object" && value !== null && "data" in value) {
    const nested = value.data;
    if (typeof nested === "object" && nested !== null && !Array.isArray(nested)) {
      return nested as T;
    }
  }
  if (typeof value === "object" && value !== null && !Array.isArray(value)) return value as T;

  return fallback;
};

export const UsagePageContent = () => {
  const { t } = useTranslation();
  const [range, setRange] = useState<UsageRange>("This month");
  const rangeDates = useMemo(() => getRangeDates(range), [range]);
  const { result: pipelinesResult } = useList<PipelineData>({
    resource: ResourceName.pipelines,
  });
  const { result: summaryResult, query: summaryQuery } = useCustom<UsageSummary>({
    url: "usage/summary",
    method: "get",
    config: { payload: rangeDates },
  });
  const { result: dailyResult, query: dailyQuery } = useCustom<UsageDailyCost[]>({
    url: "usage/dailyCost",
    method: "get",
    config: { payload: rangeDates },
  });
  const { result: byPipelineResult } = useCustom<UsageByPipeline[]>({
    url: "usage/byPipeline",
    method: "get",
    config: { payload: rangeDates },
  });
  const { result: byAgentResult } = useCustom<UsageByAgent[]>({
    url: "usage/byAgent",
    method: "get",
    config: { payload: rangeDates },
  });

  const pipelines = pipelinesResult.data;
  const pipelineNameById = new Map(pipelines.map((pipeline) => [pipeline.id, pipeline.name]));
  const summary = getObjectData<UsageSummary>(summaryResult.data, EMPTY_SUMMARY);
  const daily = getArrayData<UsageDailyCost>(dailyResult.data);
  const byPipeline = getArrayData<UsageByPipeline>(byPipelineResult.data);
  const byAgent = getArrayData<UsageByAgent>(byAgentResult.data);
  const maxPipelineTokens = Math.max(0, ...byPipeline.map((row) => row.totalTokens));
  const maxAgentTokens = Math.max(0, ...byAgent.map((row) => row.tokens));
  const peakCost = Math.max(0, ...daily.map((row) => row.cost));
  const isLoading = summaryQuery?.isLoading || dailyQuery?.isLoading;
  const rangeLabel = range.toLowerCase();
  const handleRangeItemClick = (option: UsageRange) => () => setRange(option);

  if (isLoading) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <PageHeader title={t("nav.items.usage")} />
        <PageLoadingState variant="grid" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button className="gap-1.5" size="sm" variant="outline" />}
            >
              <Calendar className="h-3.5 w-3.5" />
              {range}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {RANGE_OPTIONS.map((option) => (
                <DropdownMenuItem key={option} onClick={handleRangeItemClick(option)}>
                  {option}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        }
        eyebrow="Monitor"
        icon={<Icon className="text-muted-foreground" icon={Gauge} size={18} />}
        sub="Token and cost across this project - by run, by pipeline, by agent."
        title="Usage"
      />

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-7 pb-8">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Stat
            label="Total tokens"
            sub={`${summary.runCount} runs`}
            value={formatTokens(summary.totalTokens)}
          />
          <Stat
            label="Total cost"
            sub={`peak ${formatCost(peakCost)}`}
            value={formatCost(summary.totalCost)}
          />
          <Stat label="Runs" sub={`${byPipeline.length} pipelines`} value={summary.runCount} />
          <Stat
            label="Avg / run"
            sub={summary.runCount > 0 ? "normalized by completed jobs" : "no spend yet"}
            tone={summary.avgCostPerRun === 0 ? "default" : "success"}
            value={formatCost(summary.avgCostPerRun)}
          />
        </div>

        <section className="rounded-2xl bg-surface p-5 ring-1 ring-border shadow-soft">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-[13px] font-semibold tracking-tightish">Cost - {rangeLabel}</div>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-foreground/80" />
                spend
              </span>
              <span className="font-mono">peak {formatCost(peakCost)}</span>
            </div>
          </div>
          {daily.length === 0 ? (
            <div className="grid h-[150px] place-items-center rounded-xl bg-surface-2/60 text-[12.5px] text-muted-foreground">
              No usage in this range.
            </div>
          ) : (
            <div className="h-[170px]">
              <ResponsiveContainer height="100%" width="100%">
                <BarChart data={daily}>
                  <XAxis
                    axisLine={false}
                    dataKey="date"
                    minTickGap={24}
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--accent)" }}
                    formatter={(value) => [formatCost(Number(value)), "cost"]}
                  />
                  <Bar dataKey="cost" fill="var(--foreground)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          <section className="rounded-2xl bg-surface p-5 ring-1 ring-border shadow-soft">
            <div className="mb-2 text-[13px] font-semibold tracking-tightish">By pipeline</div>
            {byPipeline.length === 0 ? (
              <EmptyBreakdown />
            ) : (
              byPipeline
                .slice(0, 5)
                .map((row, index) => (
                  <BarRow
                    key={row.pipelineId ?? "unknown"}
                    label={
                      row.pipelineId
                        ? (pipelineNameById.get(row.pipelineId) ?? row.pipelineId)
                        : "Unassigned"
                    }
                    pct={getPct(row.totalTokens, maxPipelineTokens)}
                    sub={formatCost(row.totalCost)}
                    tone={index === 0 ? "fg" : "default"}
                    value={`${formatTokens(row.totalTokens)} tok`}
                  />
                ))
            )}
          </section>

          <section className="rounded-2xl bg-surface p-5 ring-1 ring-border shadow-soft">
            <div className="mb-2 text-[13px] font-semibold tracking-tightish">By Local Agent</div>
            {byAgent.length === 0 ? (
              <EmptyBreakdown />
            ) : (
              byAgent
                .slice(0, 5)
                .map((row, index) => (
                  <BarRow
                    key={`${row.agentRuntime}-${row.agentId}-${row.modelId ?? "model"}`}
                    label={row.agentId}
                    pct={getPct(row.tokens, maxAgentTokens)}
                    sub={`${row.runCount} runs`}
                    tone={index === 0 ? "fg" : "default"}
                    value={`${formatTokens(row.tokens)} tok`}
                  />
                ))
            )}
            <div className="mt-4 rounded-xl bg-surface-2 p-3 text-[11.5px] leading-relaxed text-muted-foreground">
              <Icon className="mr-1 inline text-foreground/70" icon={Info} size={12} />
              Agent rows are grouped from recorded runtime exports. Local-only capacity can have
              tokens without API cost.
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

const EmptyBreakdown = () => (
  <div className="rounded-xl bg-surface-2/60 p-4 text-[12.5px] text-muted-foreground">
    No usage data in this range.
  </div>
);

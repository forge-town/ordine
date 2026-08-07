import { useMemo, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Calendar, Gauge, Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCustom, useList } from "@refinedev/core";
import type { PipelineData } from "@repo/schemas";
import { Button } from "@repo/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/dropdown-menu";
import { ResourceName } from "../../constants";
import { PageHeader } from "../../components/PageHeader";
import { PageLoadingState } from "../../components/PageLoadingState";
import { BarRow, Stat } from "../../components/primitives";

const RANGE_OPTIONS = ["today", "week", "month", "quarter", "all"] as const;
type UsageRange = (typeof RANGE_OPTIONS)[number];

type UsageSummary = {
  runCount: number;
  totalTokens: number;
};

type UsageDailyTokens = {
  date: string;
  tokens: number;
};

type UsageByPipeline = {
  pipelineId: string | null;
  runCount: number;
  totalTokens: number;
};

type UsageByAgent = {
  agentId: string;
  agentRuntime: string;
  modelId: string | null;
  runCount: number;
  tokens: number;
};

const EMPTY_SUMMARY: UsageSummary = { runCount: 0, totalTokens: 0 };

const getStartOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const getRangeDates = (range: UsageRange) => {
  const to = new Date();
  const today = getStartOfDay(to);
  if (range === "today") return { from: today, to };
  if (range === "week") {
    const day = today.getDay();
    const offset = day === 0 ? 6 : day - 1;

    return { from: new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset), to };
  }
  if (range === "month") return { from: new Date(today.getFullYear(), today.getMonth(), 1), to };
  if (range === "quarter") {
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

const getPercent = (value: number, max: number) => (max > 0 ? Math.round((value / max) * 100) : 0);

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
    if (typeof nested === "object" && nested !== null && !Array.isArray(nested)) return nested as T;
  }
  if (typeof value === "object" && value !== null && !Array.isArray(value)) return value as T;

  return fallback;
};

export const UsagePageContent = () => {
  const { t } = useTranslation();
  const [range, setRange] = useState<UsageRange>("month");
  const rangeDates = useMemo(() => getRangeDates(range), [range]);
  const { result: pipelinesResult } = useList<PipelineData>({ resource: ResourceName.pipelines });
  const { result: summaryResult, query: summaryQuery } = useCustom<UsageSummary>({
    url: "usage/summary",
    method: "get",
    config: { payload: rangeDates },
  });
  const { result: dailyResult, query: dailyQuery } = useCustom<UsageDailyTokens[]>({
    url: "usage/dailyTokenSeries",
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

  const pipelineNameById = new Map(
    pipelinesResult.data.map((pipeline) => [pipeline.id, pipeline.name]),
  );
  const summary = getObjectData<UsageSummary>(summaryResult.data, EMPTY_SUMMARY);
  const daily = getArrayData<UsageDailyTokens>(dailyResult.data);
  const byPipeline = getArrayData<UsageByPipeline>(byPipelineResult.data);
  const byAgent = getArrayData<UsageByAgent>(byAgentResult.data);
  const maxPipelineTokens = Math.max(0, ...byPipeline.map((row) => row.totalTokens));
  const maxAgentTokens = Math.max(0, ...byAgent.map((row) => row.tokens));
  const peakTokens = Math.max(0, ...daily.map((row) => row.tokens));
  const averageTokens = summary.runCount > 0 ? summary.totalTokens / summary.runCount : 0;
  const isLoading = summaryQuery.isLoading || dailyQuery.isLoading;
  const handleRangeItemClick = (nextRange: UsageRange) => () => setRange(nextRange);

  if (isLoading) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <PageHeader title={t("usage.title")} />
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
              <Calendar className="size-3.5" />
              {t(`usage.ranges.${range}`)}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {RANGE_OPTIONS.map((option) => (
                <DropdownMenuItem key={option} onClick={handleRangeItemClick(option)}>
                  {t(`usage.ranges.${option}`)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        }
        eyebrow={t("nav.groups.monitor")}
        icon={<Gauge className="size-[18px] text-muted-foreground" />}
        sub={t("usage.subtitle")}
        title={t("usage.title")}
      />

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-8 pt-4 sm:px-7">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label={t("usage.totalTokens")}
            secondary={t("usage.runsValue", { count: summary.runCount })}
            value={formatTokens(summary.totalTokens)}
          />
          <Stat
            label={t("usage.runs")}
            secondary={t("usage.pipelinesValue", { count: byPipeline.length })}
            value={summary.runCount}
          />
          <Stat
            label={t("usage.avgTokens")}
            secondary={t("usage.completedRuns")}
            value={formatTokens(averageTokens)}
          />
          <Stat
            label={t("usage.activeAgents")}
            secondary={t("usage.runtimeExports")}
            tone={byAgent.length > 0 ? "success" : "default"}
            value={byAgent.length}
          />
        </div>

        <section className="rounded-lg bg-surface p-5 shadow-soft ring-1 ring-border">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="text-[13px] font-semibold">{t("usage.tokenTrend")}</div>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-sm bg-foreground/80" />
                {t("usage.tokens")}
              </span>
              <span className="font-mono">
                {t("usage.peak", { value: formatTokens(peakTokens) })}
              </span>
            </div>
          </div>
          {daily.length === 0 ? (
            <div className="grid h-[170px] place-items-center rounded-lg bg-surface-2/60 text-[12.5px] text-muted-foreground">
              {t("usage.empty")}
            </div>
          ) : (
            <div className="h-[190px]">
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
                    formatter={(value) => [formatTokens(Number(value)), t("usage.tokens")]}
                  />
                  <Bar
                    dataKey="tokens"
                    fill="var(--foreground)"
                    maxBarSize={40}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          <section className="rounded-lg bg-surface p-5 shadow-soft ring-1 ring-border">
            <div className="mb-2 text-[13px] font-semibold">{t("usage.byPipeline")}</div>
            {byPipeline.length === 0 ? (
              <div className="rounded-lg bg-surface-2/60 p-4 text-[12.5px] text-muted-foreground">
                {t("usage.empty")}
              </div>
            ) : (
              byPipeline
                .slice(0, 5)
                .map((row, index) => (
                  <BarRow
                    key={row.pipelineId ?? "unknown"}
                    label={
                      row.pipelineId
                        ? (pipelineNameById.get(row.pipelineId) ?? row.pipelineId)
                        : t("usage.unassigned")
                    }
                    percent={getPercent(row.totalTokens, maxPipelineTokens)}
                    secondaryValue={t("usage.runsShort", { count: row.runCount })}
                    tone={index === 0 ? "foreground" : "default"}
                    value={`${formatTokens(row.totalTokens)} tok`}
                  />
                ))
            )}
          </section>

          <section className="rounded-lg bg-surface p-5 shadow-soft ring-1 ring-border">
            <div className="mb-2 text-[13px] font-semibold">{t("usage.byAgent")}</div>
            {byAgent.length === 0 ? (
              <div className="rounded-lg bg-surface-2/60 p-4 text-[12.5px] text-muted-foreground">
                {t("usage.empty")}
              </div>
            ) : (
              byAgent
                .slice(0, 5)
                .map((row, index) => (
                  <BarRow
                    key={`${row.agentRuntime}-${row.agentId}-${row.modelId ?? "model"}`}
                    label={row.agentId}
                    percent={getPercent(row.tokens, maxAgentTokens)}
                    secondaryValue={t("usage.runsShort", { count: row.runCount })}
                    tone={index === 0 ? "foreground" : "default"}
                    value={`${formatTokens(row.tokens)} tok`}
                  />
                ))
            )}
            <div className="mt-4 rounded-lg bg-surface-2 p-3 text-[11.5px] leading-relaxed text-muted-foreground">
              <Info className="mr-1 inline size-3 text-foreground/70" />
              {t("usage.agentHint")}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

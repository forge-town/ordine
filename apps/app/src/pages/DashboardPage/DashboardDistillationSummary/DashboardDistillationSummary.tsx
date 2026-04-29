import { Link } from "@tanstack/react-router";
import { useList } from "@refinedev/core";
import type { Distillation } from "@repo/schemas";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ResourceName } from "@/integrations/refine/dataProvider";
import {
  buildArtifactMix,
  buildRecentDistillations,
  type DashboardDistillationPreview,
} from "../dashboardMetrics";

const STATUS_LABELS: Record<DashboardDistillationPreview["status"], string> = {
  draft: "Draft",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
};

export const DashboardDistillationSummary = () => {
  const { result } = useList<Distillation>({ resource: ResourceName.distillations });
  const distillations = result?.data ?? [];
  const artifacts = buildArtifactMix(distillations);
  const recentDistillations = buildRecentDistillations(distillations);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
      <div className="h-60 w-full rounded-2xl border border-border/70 bg-background/60 p-3">
        <ResponsiveContainer height="100%" width="100%">
          <BarChart data={artifacts} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="label"
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickLine={false}
              width={28}
            />
            <Tooltip
              contentStyle={{
                borderColor: "var(--border)",
                borderRadius: 16,
                backgroundColor: "var(--card)",
                color: "var(--foreground)",
              }}
            />
            <Bar dataKey="value" fill="var(--color-chart-3)" radius={[10, 10, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-3">
        {recentDistillations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-background/40 p-5 text-sm text-muted-foreground">
            No distillations yet. Start one from a job or pipeline to build reusable assets.
          </div>
        ) : (
          recentDistillations.map((distillation) => (
            <Link
              key={distillation.id}
              params={{ distillationId: distillation.id }}
              to="/distillations/$distillationId"
            >
              <div className="rounded-2xl border border-border/70 bg-background/60 p-4 transition-colors hover:border-primary/40">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {distillation.title}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      {distillation.mode}
                    </p>
                  </div>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
                    {STATUS_LABELS[distillation.status]}
                  </span>
                </div>
                <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted-foreground">
                  {distillation.summary ||
                    "Open this distillation to inspect the extracted result."}
                </p>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
};

import type { DashboardSnapshotMetric } from "../dashboardMetrics";

export type DashboardSnapshotStripProps = {
  metrics: DashboardSnapshotMetric[];
};

export const DashboardSnapshotStrip = ({ metrics }: DashboardSnapshotStripProps) => {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="rounded-2xl border border-border/70 bg-background/70 p-4"
        >
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {metric.label}
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
            {metric.value}
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{metric.hint}</p>
        </div>
      ))}
    </div>
  );
};

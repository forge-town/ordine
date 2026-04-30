import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useList } from "@refinedev/core";
import type { Job } from "@repo/schemas";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { buildStatuses } from "../dashboardMetrics";

const STATUS_COLORS: Record<string, string> = {
  running: "var(--color-chart-2)",
  queued: "var(--color-chart-3)",
  done: "var(--color-chart-1)",
  failed: "var(--color-chart-4)",
};

export const DashboardStatusChart = () => {
  const { result } = useList<Job>({ resource: ResourceName.jobs });
  const data = buildStatuses(result?.data ?? []);

  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer height="100%" width="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
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
          <Bar dataKey="value" radius={[10, 10, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.key} fill={STATUS_COLORS[entry.key] ?? "var(--color-chart-2)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

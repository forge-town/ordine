import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useList } from "@refinedev/core";
import type { Job } from "@repo/schemas";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { buildActivity } from "../dashboardMetrics";

export const DashboardActivityChart = () => {
  const { result } = useList<Job>({ resource: ResourceName.jobs });
  const data = buildActivity(result?.data ?? []);

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer height="100%" width="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="dashboard-total" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.38} />
              <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="dashboard-failed" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--color-chart-4)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--color-chart-4)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
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
          <Area
            dataKey="failed"
            fill="url(#dashboard-failed)"
            fillOpacity={1}
            stroke="var(--color-chart-4)"
            strokeWidth={2}
            type="monotone"
          />
          <Area
            dataKey="total"
            fill="url(#dashboard-total)"
            fillOpacity={1}
            stroke="var(--color-chart-2)"
            strokeWidth={2.5}
            type="monotone"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

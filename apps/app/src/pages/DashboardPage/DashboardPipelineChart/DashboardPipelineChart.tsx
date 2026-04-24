import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DashboardPipelineDatum } from "../dashboardMetrics";

export type DashboardPipelineChartProps = {
  data: DashboardPipelineDatum[];
};

export const DashboardPipelineChart = ({ data }: DashboardPipelineChartProps) => {
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer height="100%" width="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 8, left: 24, bottom: 0 }}>
          <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="4 4" />
          <XAxis
            allowDecimals={false}
            axisLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickLine={false}
            type="number"
          />
          <YAxis
            axisLine={false}
            dataKey="name"
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickLine={false}
            type="category"
            width={120}
          />
          <Tooltip
            contentStyle={{
              borderColor: "var(--border)",
              borderRadius: 16,
              backgroundColor: "var(--card)",
              color: "var(--foreground)",
            }}
          />
          <Bar dataKey="runs" fill="var(--color-chart-2)" name="Runs" radius={[0, 10, 10, 0]} />
          <Bar dataKey="failed" fill="var(--color-chart-4)" name="Failed" radius={[0, 10, 10, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

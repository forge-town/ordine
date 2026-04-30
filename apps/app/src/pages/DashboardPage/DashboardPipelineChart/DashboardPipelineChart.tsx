import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useList } from "@refinedev/core";
import type { Job } from "@repo/schemas";
import type { PipelineData } from "@repo/pipeline-engine/schemas";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { buildPipelineRows } from "../dashboardMetrics";

export const DashboardPipelineChart = () => {
  const { result: jobsResult } = useList<Job>({ resource: ResourceName.jobs });
  const { result: pipelinesResult } = useList<PipelineData>({
    resource: ResourceName.pipelines,
  });
  const data = buildPipelineRows(jobsResult?.data ?? [], pipelinesResult?.data ?? []);

  return (
    <div className="h-65 w-full">
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

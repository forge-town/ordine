import { useList } from "@refinedev/core";
import type { Distillation, GithubProject, Job } from "@repo/schemas";
import type { PipelineData } from "@repo/pipeline-engine/schemas";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { buildSnapshot } from "../dashboardMetrics";

export const DashboardSnapshotStrip = () => {
  const { result: jobsResult } = useList<Job>({ resource: ResourceName.jobs });
  const { result: pipelinesResult } = useList<PipelineData>({
    resource: ResourceName.pipelines,
  });
  const { result: projectsResult } = useList<GithubProject>({
    resource: ResourceName.githubProjects,
  });
  const { result: distillationsResult } = useList<Distillation>({
    resource: ResourceName.distillations,
  });
  const metrics = buildSnapshot(
    jobsResult?.data ?? [],
    pipelinesResult?.data ?? [],
    projectsResult?.data?.length ?? 0,
    distillationsResult?.data ?? []
  );

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

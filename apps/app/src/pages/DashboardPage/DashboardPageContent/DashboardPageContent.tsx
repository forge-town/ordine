import { Link } from "@tanstack/react-router";
import { Activity, ArrowRight, LayoutDashboard, Lightbulb, Sparkles, Workflow } from "lucide-react";
import { useList } from "@refinedev/core";
import { useTranslation } from "react-i18next";
import type { Distillation, GithubProject, Job } from "@repo/schemas";
import type { PipelineData } from "@repo/pipeline-engine/schemas";
import { PageHeader } from "@/components/PageHeader";
import { PageLoadingState } from "@/components/PageLoadingState";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { DashboardActivityChart } from "../DashboardActivityChart";
import { DashboardDistillationSummary } from "../DashboardDistillationSummary";
import { DashboardPanel } from "../DashboardPanel";
import { DashboardPipelineChart } from "../DashboardPipelineChart";
import { DashboardSnapshotStrip } from "../DashboardSnapshotStrip";
import { DashboardStatusChart } from "../DashboardStatusChart";
import { JobActivityRow } from "../JobActivityRow";
import { buildDashboardMetrics } from "../dashboardMetrics";

const QUICK_ACTIONS = [
  {
    icon: Workflow,
    key: "design",
    to: "/canvas",
  },
  {
    icon: Activity,
    key: "monitor",
    to: "/jobs",
  },
  {
    icon: Sparkles,
    key: "distill",
    to: "/distillations",
  },
  {
    icon: Lightbulb,
    key: "bestPractices",
    to: "/best-practices",
  },
] as const;

export const DashboardPageContent = () => {
  const { t } = useTranslation();
  const { result: pipelinesResult, query: pipelinesQuery } = useList<PipelineData>({
    resource: ResourceName.pipelines,
  });
  const { result: projectsResult, query: projectsQuery } = useList<GithubProject>({
    resource: ResourceName.githubProjects,
  });
  const { result: jobsResult, query: jobsQuery } = useList<Job>({
    resource: ResourceName.jobs,
  });
  const { result: distillationsResult, query: distillationsQuery } = useList<Distillation>({
    resource: ResourceName.distillations,
  });

  const pipelines = pipelinesResult?.data ?? [];
  const projects = projectsResult?.data ?? [];
  const jobs = jobsResult?.data ?? [];
  const distillations = distillationsResult?.data ?? [];
  const runningJobs = jobs.filter((job) => job.status === "running").length;
  const isLoading = !!(
    pipelinesQuery?.isLoading ||
    projectsQuery?.isLoading ||
    jobsQuery?.isLoading ||
    distillationsQuery?.isLoading
  );
  const metrics = buildDashboardMetrics(jobs, pipelines, projects.length, distillations);

  if (isLoading) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <PageHeader title={t("dashboard.title")} />
        <PageLoadingState variant="grid" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        badge={
          runningJobs > 0 ? (
            <span className="ml-3 flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {runningJobs} {t("jobs.running")}
            </span>
          ) : undefined
        }
        icon={<LayoutDashboard className="h-4 w-4 text-primary" />}
        title={t("dashboard.title")}
      />

      <div className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(120,120,120,0.08),transparent_45%)] p-6">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
            <DashboardPanel
              description={t("dashboard.activityDescription")}
              title={t("dashboard.activityTitle")}
            >
              <DashboardActivityChart data={metrics.activity} />
            </DashboardPanel>

            <DashboardPanel
              description={t("dashboard.snapshotDescription")}
              title={t("dashboard.snapshotTitle")}
            >
              <DashboardSnapshotStrip metrics={metrics.snapshot} />
            </DashboardPanel>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <DashboardPanel
              description={t("dashboard.pipelineHealthDescription")}
              title={t("dashboard.pipelineHealthTitle")}
            >
              <DashboardPipelineChart data={metrics.pipelines} />
            </DashboardPanel>

            <DashboardPanel
              description={t("dashboard.statusDescription")}
              title={t("dashboard.statusTitle")}
            >
              <DashboardStatusChart data={metrics.statuses} />
            </DashboardPanel>
          </div>

          <DashboardPanel
            actions={
              <Link
                className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                to="/distillations"
              >
                {t("dashboard.viewAll")}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
            description={t("dashboard.distillationDescription")}
            title={t("dashboard.distillationTitle")}
          >
            <DashboardDistillationSummary
              artifacts={metrics.artifactMix}
              recentDistillations={metrics.recentDistillations}
            />
          </DashboardPanel>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
            <DashboardPanel
              actions={
                <Link
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                  to="/jobs"
                >
                  {t("dashboard.viewAll")}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              }
              description={t("dashboard.recentJobsDescription")}
              title={t("dashboard.recentJobs")}
            >
              {metrics.recentJobs.length === 0 ? (
                <div className="flex min-h-[220px] flex-col items-center justify-center text-center">
                  <Activity className="h-7 w-7 text-muted-foreground/30" />
                  <p className="mt-3 text-sm text-muted-foreground">{t("dashboard.noJobs")}</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {metrics.recentJobs.map((job) => (
                    <JobActivityRow key={job.id} job={job} />
                  ))}
                </div>
              )}
            </DashboardPanel>

            <DashboardPanel
              description={t("dashboard.quickActionsDescription")}
              title={t("dashboard.quickActions")}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                {QUICK_ACTIONS.map((action) => {
                  const Icon = action.icon;

                  return (
                    <Link key={action.key} to={action.to as "/"}>
                      <div className="group rounded-2xl border border-border/70 bg-background/60 p-4 transition-all hover:border-primary/40 hover:shadow-sm">
                        <div className="flex items-center justify-between">
                          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                            <Icon className="h-5 w-5" />
                          </span>
                          <ArrowRight className="h-4 w-4 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground" />
                        </div>
                        <p className="mt-4 text-sm font-semibold text-foreground">
                          {t(
                            `dashboard.quickAction${action.key[0].toUpperCase()}${action.key.slice(1)}`
                          )}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {t(
                            `dashboard.quickAction${action.key[0].toUpperCase()}${action.key.slice(1)}Sub`
                          )}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </DashboardPanel>
          </div>
        </div>
      </div>
    </div>
  );
};

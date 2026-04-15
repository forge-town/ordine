import { Link } from "@tanstack/react-router";
import { Layers, FolderGit2, Activity, Lightbulb, Workflow } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { PipelineEntity, GithubProjectRow, JobRow } from "@repo/models";
import { useList } from "@refinedev/core";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { StatCard } from "../StatCard";
import { JobActivityRow } from "../JobActivityRow";

export const DashboardPageContent = () => {
  const { result: pipelinesResult } = useList<PipelineEntity>({ resource: ResourceName.pipelines });
  const { result: projectsResult } = useList<GithubProjectRow>({
    resource: ResourceName.githubProjects,
  });
  const { result: jobsResult } = useList<JobRow>({ resource: ResourceName.jobs });
  const pipelines = pipelinesResult?.data ?? [];
  const projects = projectsResult?.data ?? [];
  const jobs = jobsResult?.data ?? [];
  const { t } = useTranslation();
  const runningJobs = jobs.filter((j: JobRow) => j.status === "running").length;
  const failedJobs = jobs.filter((j: JobRow) => j.status === "failed").length;
  const recentJobs = jobs.slice(0, 8);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center border-b border-border bg-background px-6">
        <h1 className="text-base font-semibold text-foreground">{t("dashboard.title")}</h1>
        {runningJobs > 0 && (
          <span className="ml-3 flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {runningJobs} {t("jobs.running")}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            icon={FolderGit2}
            label={t("nav.projects")}
            sub={t("projects.connectGitHub")}
            to="/projects"
            value={projects.length}
          />
          <StatCard
            icon={Layers}
            label={t("nav.pipelines")}
            sub={t("pipelines.title")}
            to="/pipelines"
            value={pipelines.length}
          />
          <StatCard
            icon={Activity}
            label={t("nav.jobs")}
            sub={
              failedJobs > 0
                ? `${failedJobs} ${t("jobs.failed")}`
                : runningJobs > 0
                  ? `${runningJobs} ${t("jobs.running")}`
                  : t("jobs.done")
            }
            to="/jobs"
            value={jobs.length}
          />
        </div>

        {/* Recent Jobs */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground">
                {t("dashboard.recentJobs")}
              </span>
            </div>
            <Link
              className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
              to="/jobs"
            >
              {t("dashboard.viewAll")}
            </Link>
          </div>
          {recentJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Activity className="h-7 w-7 text-muted-foreground/30" />
              <p className="mt-2 text-xs text-muted-foreground">{t("dashboard.noJobs")}</p>
            </div>
          ) : (
            <div className="py-1">
              {recentJobs.map((j: JobRow) => (
                <JobActivityRow key={j.id} job={j} />
              ))}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("dashboard.quickActions")}
          </h2>
          <div className="grid grid-cols-4 gap-3">
            {[
              {
                icon: Workflow,
                label: t("dashboard.quickActionDesign"),
                sub: t("dashboard.quickActionDesignSub"),
                to: "/canvas",
              },
              {
                icon: FolderGit2,
                label: t("dashboard.quickActionProjects"),
                sub: t("dashboard.quickActionProjectsSub"),
                to: "/projects",
              },
              {
                icon: Activity,
                label: t("dashboard.quickActionMonitor"),
                sub: t("dashboard.quickActionMonitorSub"),
                to: "/jobs",
              },
              {
                icon: Lightbulb,
                label: t("dashboard.quickActionBestPractices"),
                sub: t("dashboard.quickActionBestPracticesSub"),
                to: "/best-practices",
              },
            ].map((a) => {
              const Icon = a.icon;
              return (
                <Link key={a.to} to={a.to as "/"}>
                  <div className="group flex cursor-pointer flex-col gap-2 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-sm">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{a.label}</p>
                      <p className="text-xs text-muted-foreground">{a.sub}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

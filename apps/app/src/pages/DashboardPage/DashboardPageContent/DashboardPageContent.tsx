import { Link } from "@tanstack/react-router";
import { Layers, FolderGit2, Activity, Lightbulb, Workflow } from "lucide-react";
import type { PipelineEntity } from "@/models/daos/pipelinesDao";
import type { GithubProjectEntity } from "@/models/daos/githubProjectsDao";
import type { JobEntity } from "@/models/daos/jobsDao";
import { StatCard } from "../StatCard";
import { JobActivityRow } from "../JobActivityRow";

export type DashboardPageContentProps = {
  pipelines: PipelineEntity[];
  projects: GithubProjectEntity[];
  jobs: JobEntity[];
};

export const DashboardPageContent = ({ pipelines, projects, jobs }: DashboardPageContentProps) => {
  const runningJobs = jobs.filter((j) => j.status === "running").length;
  const failedJobs = jobs.filter((j) => j.status === "failed").length;
  const recentJobs = jobs.slice(0, 8);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center border-b border-border bg-background px-6">
        <h1 className="text-base font-semibold text-foreground">仪表盘</h1>
        {runningJobs > 0 && (
          <span className="ml-3 flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {runningJobs} 个 Job 运行中
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            icon={FolderGit2}
            label="GitHub 项目"
            sub="已连接的仓库"
            to="/projects"
            value={projects.length}
          />
          <StatCard
            icon={Layers}
            label="Pipelines"
            sub="已设计的流水线"
            to="/pipelines"
            value={pipelines.length}
          />
          <StatCard
            icon={Activity}
            label="Jobs"
            sub={
              failedJobs > 0
                ? `${failedJobs} 失败`
                : runningJobs > 0
                  ? `${runningJobs} 运行中`
                  : "全部正常"
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
              <span className="text-xs font-semibold text-muted-foreground">最近 Jobs</span>
            </div>
            <Link
              className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
              to="/jobs"
            >
              全部查看
            </Link>
          </div>
          {recentJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Activity className="h-7 w-7 text-muted-foreground/30" />
              <p className="mt-2 text-xs text-muted-foreground">触发 Pipeline 后会在此显示</p>
            </div>
          ) : (
            <div className="py-1">
              {recentJobs.map((j) => (
                <JobActivityRow key={j.id} job={j} />
              ))}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            快速入口
          </h2>
          <div className="grid grid-cols-4 gap-3">
            {[
              {
                icon: Workflow,
                label: "设计 Pipeline",
                sub: "在 Canvas 上创建流水线",
                to: "/canvas",
              },
              {
                icon: FolderGit2,
                label: "连接项目",
                sub: "关联 GitHub 仓库",
                to: "/projects",
              },
              {
                icon: Activity,
                label: "监控 Jobs",
                sub: "查看后台执行状态",
                to: "/jobs",
              },
              {
                icon: Lightbulb,
                label: "最佳实践",
                sub: "记录和查阅规范",
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

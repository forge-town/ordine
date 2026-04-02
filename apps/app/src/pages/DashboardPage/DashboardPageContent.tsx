import { Link } from "@tanstack/react-router";
import {
  Layers,
  FolderGit2,
  Activity,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  ArrowRight,
  Lightbulb,
  Workflow,
} from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import type { PipelineEntity } from "@/models/daos/pipelinesDao";
import type { GithubProjectEntity } from "@/models/daos/githubProjectsDao";
import type { JobEntity } from "@/models/daos/jobsDao";

// ── Stat card ─────────────────────────────────────────────────────────────────

const StatCard = ({
  icon: Icon,
  label,
  value,
  sub,
  to,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  sub: string;
  to: string;
}) => {
  return (
    <Link to={to as "/"}>
      <div className="group rounded-xl border border-gray-100 bg-white px-5 py-4 shadow-sm hover:border-gray-300 hover:shadow-md transition-all cursor-pointer">
        <div className="flex items-center justify-between">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
            <Icon className="h-4 w-4" />
          </span>
          <ArrowRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-gray-500 transition-colors" />
        </div>
        <p className="mt-3 text-2xl font-bold text-gray-900">{value}</p>
        <p className="mt-0.5 text-sm font-medium text-gray-700">{label}</p>
        <p className="mt-0.5 text-xs text-gray-400">{sub}</p>
      </div>
    </Link>
  );
};

// ── Recent activity row ───────────────────────────────────────────────────────

const JOB_STATUS_ICON: Record<string, React.ElementType> = {
  queued: Clock,
  running: Loader2,
  done: CheckCircle2,
  failed: XCircle,
};
const JOB_STATUS_CLS: Record<string, string> = {
  queued: "text-gray-400",
  running: "text-gray-600",
  done: "text-gray-600",
  failed: "text-gray-600",
};

const JobActivityRow = ({ job }: { job: JobEntity }) => {
  const Icon = JOB_STATUS_ICON[job.status] ?? Clock;
  return (
    <Link to="/jobs/$jobId" params={{ jobId: job.id }}>
      <div className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-gray-50 transition-colors">
        <Icon
          className={cn(
            "h-4 w-4 shrink-0",
            JOB_STATUS_CLS[job.status],
            job.status === "running" && "animate-spin",
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-800">
            {job.title}
          </p>
          <p className="text-[11px] text-gray-400">
            {new Date(job.createdAt).toLocaleString("zh-CN", {
              month: "numeric",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
          {job.status}
        </span>
      </div>
    </Link>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────

export const DashboardPageContent = ({
  pipelines,
  projects,
  jobs,
}: {
  pipelines: PipelineEntity[];
  projects: GithubProjectEntity[];
  jobs: JobEntity[];
}) => {
  const runningJobs = jobs.filter((j) => j.status === "running").length;
  const failedJobs = jobs.filter((j) => j.status === "failed").length;
  const recentJobs = jobs.slice(0, 8);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center border-b border-gray-200 bg-white px-6">
        <h1 className="text-base font-semibold text-gray-900">仪表盘</h1>
        {runningJobs > 0 && (
          <span className="ml-3 flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
            {runningJobs} 个 Job 运行中
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard
            icon={FolderGit2}
            label="GitHub 项目"
            value={projects.length}
            sub="已连接的仓库"
            to="/projects"
          />
          <StatCard
            icon={Layers}
            label="Pipelines"
            value={pipelines.length}
            sub="已设计的流水线"
            to="/pipelines"
          />
          <StatCard
            icon={Activity}
            label="Jobs"
            value={jobs.length}
            sub={
              failedJobs > 0
                ? `${failedJobs} 失败`
                : runningJobs > 0
                  ? `${runningJobs} 运行中`
                  : "全部正常"
            }
            to="/jobs"
          />
        </div>

        {/* Recent Jobs */}
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-xs font-semibold text-gray-600">
                最近 Jobs
              </span>
            </div>
            <Link
              to="/jobs"
              className="text-[11px] text-gray-400 hover:text-gray-600 hover:underline"
            >
              全部查看
            </Link>
          </div>
          {recentJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Activity className="h-7 w-7 text-gray-200" />
              <p className="mt-2 text-xs text-gray-400">
                触发 Pipeline 后会在此显示
              </p>
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
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
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
                  <div className="group flex cursor-pointer flex-col gap-2 rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:border-gray-300 hover:shadow-md">
                    <Icon className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">
                        {a.label}
                      </p>
                      <p className="text-xs text-gray-400">{a.sub}</p>
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

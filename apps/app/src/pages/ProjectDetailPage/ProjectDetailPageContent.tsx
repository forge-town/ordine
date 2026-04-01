import { useNavigate } from "@tanstack/react-router";
import {
  FolderGit2,
  ExternalLink,
  GitBranch,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Wrench,
  ArrowLeft,
} from "lucide-react";
import { Route } from "@/routes/projects.$projectId";
import type { WorkEntity } from "@/models/daos/worksDao";
import type { GithubProjectEntity } from "@/models/daos/githubProjectsDao";
import { cn } from "@repo/ui/lib/utils";

const STATUS_CONFIG: Record<
  WorkEntity["status"],
  { label: string; icon: React.ElementType; color: string }
> = {
  pending: { label: "等待中", icon: Clock, color: "text-gray-500" },
  running: { label: "运行中", icon: Loader2, color: "text-blue-500" },
  success: { label: "成功", icon: CheckCircle2, color: "text-emerald-500" },
  failed: { label: "失败", icon: XCircle, color: "text-red-500" },
};

const OBJECT_LABEL: Record<WorkEntity["object"]["type"], string> = {
  file: "文件",
  folder: "文件夹",
  project: "整个项目",
};

function WorkRow({ work }: { work: WorkEntity }) {
  const cfg = STATUS_CONFIG[work.status];
  const Icon = cfg.icon;
  return (
    <div className="flex items-center gap-4 rounded-lg border border-gray-100 bg-white px-4 py-3 hover:border-gray-200 transition-colors">
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-50",
          cfg.color,
        )}
      >
        <Icon
          className={cn("h-4 w-4", work.status === "running" && "animate-spin")}
        />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-800">
          {work.pipelineName}
        </p>
        <p className="mt-0.5 truncate text-xs text-gray-400">
          {OBJECT_LABEL[work.object.type]}
          {work.object.path !== "/" && (
            <span className="ml-1 font-mono">{work.object.path}</span>
          )}
        </p>
      </div>
      <div className="text-right shrink-0">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
            work.status === "success" && "bg-emerald-50 text-emerald-700",
            work.status === "failed" && "bg-red-50 text-red-700",
            work.status === "running" && "bg-blue-50 text-blue-700",
            work.status === "pending" && "bg-gray-100 text-gray-600",
          )}
        >
          {cfg.label}
        </span>
        <p className="mt-1 text-[10px] text-gray-400">
          {new Date(work.createdAt).toLocaleString("zh-CN", {
            month: "numeric",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}

function ProjectMeta({ project }: { project: GithubProjectEntity }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gray-900">
          <FolderGit2 className="h-6 w-6 text-white" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-gray-900">
              {project.owner}/{project.repo}
            </h2>
            <a
              href={project.githubUrl}
              target="_blank"
              rel="noreferrer"
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
          {project.description && (
            <p className="mt-1 text-sm text-gray-500">{project.description}</p>
          )}
          <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-400">
            <GitBranch className="h-3.5 w-3.5" />
            <span>{project.branch}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export const ProjectDetailPageContent = () => {
  const { project, works, pipelines } = Route.useLoaderData();
  const navigate = useNavigate();

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        项目不存在
      </div>
    );
  }

  const activeWorks = works.filter(
    (w) => w.status === "pending" || w.status === "running",
  );
  const finishedWorks = works.filter(
    (w) => w.status === "success" || w.status === "failed",
  );

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gray-50">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-6">
        <button
          onClick={() => void navigate({ to: "/projects" })}
          className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 text-gray-500" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold text-gray-900 truncate">
            {project.name}
          </h1>
          <p className="text-xs text-gray-400 truncate">
            {project.owner}/{project.repo}
          </p>
        </div>
        <button
          onClick={() =>
            void navigate({
              to: "/projects/$projectId/workspace",
              params: { projectId: project.id },
            })
          }
          className="flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 transition-colors"
        >
          <Wrench className="h-3.5 w-3.5" />
          打开工作区
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Project meta */}
        <ProjectMeta project={project} />

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          {[
            {
              label: "可用 Pipeline",
              value: pipelines.length,
              color: "text-violet-600",
            },
            {
              label: "进行中 Works",
              value: activeWorks.length,
              color: "text-blue-600",
            },
            {
              label: "历史 Works",
              value: works.length,
              color: "text-gray-700",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-gray-100 bg-white px-5 py-4 shadow-sm"
            >
              <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
              <p className="mt-0.5 text-xs text-gray-400">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Active works */}
        {activeWorks.length > 0 && (
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Play className="h-4 w-4 text-blue-500" />
              进行中
            </h3>
            <div className="space-y-2">
              {activeWorks.map((w) => (
                <WorkRow key={w.id} work={w} />
              ))}
            </div>
          </section>
        )}

        {/* History */}
        <section>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">
            历史 Works
          </h3>
          {finishedWorks.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white py-10 text-center">
              <Clock className="h-8 w-8 text-gray-300" />
              <p className="mt-2 text-sm text-gray-400">还没有执行记录</p>
              <p className="mt-0.5 text-xs text-gray-300">
                在工作区选择对象并触发 Pipeline
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {finishedWorks.map((w) => (
                <WorkRow key={w.id} work={w} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

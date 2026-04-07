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
import { Button } from "@repo/ui/button";

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

const WorkRow = ({ work }: { work: WorkEntity }) => {
  const cfg = STATUS_CONFIG[work.status];
  const Icon = cfg.icon;
  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3 hover:border-primary/50 transition-colors">
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/30",
          cfg.color,
        )}
      >
        <Icon
          className={cn("h-4 w-4", work.status === "running" && "animate-spin")}
        />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {work.pipelineName}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
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
        <p className="mt-1 text-[10px] text-muted-foreground">
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
};

const ProjectMeta = ({ project }: { project: GithubProjectEntity }) => {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted">
          <FolderGit2 className="h-6 w-6 text-muted-foreground" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-foreground">
              {project.owner}/{project.repo}
            </h2>
            <a
              className="text-muted-foreground hover:text-foreground transition-colors"
              href={project.githubUrl}
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
          {project.description && (
            <p className="mt-1 text-sm text-muted-foreground">
              {project.description}
            </p>
          )}
          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <GitBranch className="h-3.5 w-3.5" />
            <span>{project.branch}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ProjectDetailPageContent = () => {
  const { project, works, pipelines } = Route.useLoaderData();
  const navigate = useNavigate();

  const handleNavigateProjects = () => void navigate({ to: "/projects" });
  const handleNavigateWorkspace = () => {
    if (!project) return;
    void navigate({
      to: "/projects/$projectId/workspace",
      params: { projectId: project.id },
    });
  };

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
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
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-6">
        <Button
          className="h-8 w-8"
          size="icon"
          variant="ghost"
          onClick={handleNavigateProjects}
        >
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold text-foreground truncate">
            {project.name}
          </h1>
          <p className="text-xs text-muted-foreground truncate">
            {project.owner}/{project.repo}
          </p>
        </div>
        <Button size="sm" onClick={handleNavigateWorkspace}>
          <Wrench className="h-3.5 w-3.5" />
          打开工作区
        </Button>
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
              className="rounded-xl border border-border bg-card px-5 py-4"
            >
              <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Active works */}
        {activeWorks.length > 0 && (
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
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
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            历史 Works
          </h3>
          {finishedWorks.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-10 text-center">
              <Clock className="h-8 w-8 text-muted-foreground/30" />
              <p className="mt-2 text-sm text-muted-foreground">
                还没有执行记录
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground/60">
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

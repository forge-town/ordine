import { useNavigate } from "@tanstack/react-router";
import { Play, Clock, Wrench, ArrowLeft } from "lucide-react";
import { Route } from "@/routes/projects.$projectId.index";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/button";
import { WorkRow } from "../WorkRow";
import { ProjectMeta } from "../ProjectMeta";

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

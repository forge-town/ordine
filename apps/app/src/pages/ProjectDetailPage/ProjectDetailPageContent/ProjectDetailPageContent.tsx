import { useNavigate } from "@tanstack/react-router";
import { Wrench, ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Route } from "@/routes/_layout/projects.$projectId.index";
import { useOne, useList } from "@refinedev/core";
import { ResourceName } from "@/integrations/refine/dataProvider";
import type { GithubProjectEntity, StoredPipeline } from "@repo/models";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/button";
import { ProjectMeta } from "../ProjectMeta";

export const ProjectDetailPageContent = () => {
  const { projectId } = Route.useParams();
  const { result: projectResult } = useOne<GithubProjectEntity>({
    resource: ResourceName.githubProjects,
    id: projectId,
  });
  const { result: pipelinesResult } = useList<StoredPipeline>({ resource: ResourceName.pipelines });
  const project = projectResult ?? null;
  const pipelines = pipelinesResult?.data ?? [];
  const navigate = useNavigate();
  const { t } = useTranslation();

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
        {t("projects.notFound")}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-6">
        <Button className="h-8 w-8" size="icon" variant="ghost" onClick={handleNavigateProjects}>
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold text-foreground truncate">{project.name}</h1>
          <p className="text-xs text-muted-foreground truncate">
            {project.owner}/{project.repo}
          </p>
        </div>
        <Button size="sm" onClick={handleNavigateWorkspace}>
          <Wrench className="h-3.5 w-3.5" />
          {t("projects.openWorkspace")}
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Project meta */}
        <ProjectMeta project={project} />

        {/* Stats row */}
        <div className="grid grid-cols-1 gap-4">
          <div className="rounded-xl border border-border bg-card px-5 py-4">
            <p className={cn("text-2xl font-bold", "text-violet-600")}>{pipelines.length}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("projects.availablePipelines")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

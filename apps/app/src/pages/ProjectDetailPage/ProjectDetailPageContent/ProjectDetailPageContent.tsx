import { useNavigate } from "@tanstack/react-router";
import { Wrench } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Route } from "@/routes/_layout/projects.$projectId.index";
import { useOne, useList } from "@refinedev/core";
import { ResourceName } from "@/integrations/refine/dataProvider";
import type { GithubProject } from "@repo/schemas";
import type { PipelineData } from "@repo/pipeline-engine/schemas";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/button";
import { PageLoadingState } from "@/components/PageLoadingState";
import { PageHeader } from "@/components/PageHeader";
import { ProjectMeta } from "../ProjectMeta";

export const ProjectDetailPageContent = () => {
  const { projectId } = Route.useParams();
  const { result: projectResult, query: projectQuery } = useOne<GithubProject>({
    resource: ResourceName.githubProjects,
    id: projectId,
  });
  const { result: pipelinesResult, query: pipelinesQuery } = useList<PipelineData>({
    resource: ResourceName.pipelines,
  });
  const project = projectResult ?? null;
  const pipelines = pipelinesResult?.data ?? [];
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleNavigateWorkspace = () => {
    if (!project) return;
    void navigate({
      to: "/projects/$projectId/workspace",
      params: { projectId: project.id },
    });
  };

  if (projectQuery?.isLoading || pipelinesQuery?.isLoading) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <PageHeader title={t("projects.title")} />
        <PageLoadingState variant="detail" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        {t("projects.notFound")}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        actions={
          <Button size="sm" onClick={handleNavigateWorkspace}>
            <Wrench className="h-3.5 w-3.5" />
            {t("projects.openWorkspace")}
          </Button>
        }
        backTo="/projects"
        title={project.name}
      />

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

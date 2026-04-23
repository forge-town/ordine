import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, FolderGit2, ChevronRight, Play, GitBranch, Layers } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Route } from "@/routes/_layout/projects.$projectId.workspace";
import { useOne, useList, useCustomMutation } from "@refinedev/core";
import { ResourceName } from "@/integrations/refine/dataProvider";
import type { GithubProject } from "@repo/schemas";
import type { PipelineData } from "@repo/pipeline-engine/schemas";
import { Button } from "@repo/ui/button";
import { useStore } from "zustand";
import { PageLoadingState } from "@/components/PageLoadingState";
import { ObjectRow, type ObjectItem } from "../ObjectRow";
import { PipelineRow } from "../PipelineRow";
import { useProjectWorkspacePageStore } from "../_store";

const buildObjectTree = (owner: string, repo: string, entireProject: string): ObjectItem[] => [
  { type: "project", path: "/", label: `${owner}/${repo} (${entireProject})` },
  { type: "folder", path: "src/", label: "src/" },
  { type: "folder", path: "src/pages/", label: "src/pages/" },
  { type: "folder", path: "src/components/", label: "src/components/" },
  { type: "file", path: "src/index.ts", label: "src/index.ts" },
  { type: "file", path: "package.json", label: "package.json" },
];

export const ProjectWorkspacePageContent = () => {
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
  const store = useProjectWorkspacePageStore();
  const selectedObjects = useStore(store, (s) => s.selectedObjects);
  const selectedPipelineId = useStore(store, (s) => s.selectedPipelineId);
  const handleToggleObjectInStore = useStore(store, (s) => s.handleToggleObject);
  const handleSelectPipelineInStore = useStore(store, (s) => s.handleSelectPipeline);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { mutate: runMutate } = useCustomMutation();

  if (projectQuery?.isLoading || pipelinesQuery?.isLoading) {
    return <PageLoadingState title={t("workspace.title")} variant="detail" />;
  }

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        {t("workspace.notFound")}
      </div>
    );
  }

  const objects = buildObjectTree(project.owner, project.repo, t("workspace.entireProject"));
  const selectedPipeline = pipelines.find((p: PipelineData) => p.id === selectedPipelineId);

  const toggleObject = (path: string) => {
    handleToggleObjectInStore(path);
  };

  const canTrigger = selectedObjects.size > 0 && selectedPipelineId !== null;

  const handleTrigger = () => {
    if (!canTrigger || !selectedPipeline) return;
    runMutate(
      {
        url: "pipelines/run",
        method: "post",
        values: {
          id: selectedPipeline.id,
          inputPath: [...selectedObjects].join(","),
          projectId: project.id,
        },
      },
      {
        onSuccess: (data) => {
          const result = data?.data as { jobId: string } | undefined;
          if (result?.jobId) {
            void navigate({
              to: "/jobs",
            });
          }
        },
      },
    );
  };

  const handleNavigateBack = () =>
    void navigate({
      to: "/projects/$projectId",
      params: { projectId: project.id },
    });

  const handleTriggerClick = () => handleTrigger();

  const handleToggleObject = (path: string) => () => toggleObject(path);

  const handleNavigatePipelines = () => void navigate({ to: "/pipelines" });

  const handleSelectPipeline = (id: string) => () => handleSelectPipelineInStore(id);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-6">
        <Button className="h-8 w-8" size="icon" variant="ghost" onClick={handleNavigateBack}>
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold text-foreground truncate">{t("workspace.title")}</h1>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <FolderGit2 className="h-3 w-3" />
            <span>
              {project.owner}/{project.repo}
            </span>
            <GitBranch className="ml-1 h-3 w-3" />
            <span>{project.branch}</span>
          </div>
        </div>
        {/* Trigger button */}
        <Button disabled={!canTrigger} size="sm" onClick={handleTriggerClick}>
          <Play className="h-3.5 w-3.5" />
          {t("workspace.triggerWork")} {selectedObjects.size > 0 && `(${selectedObjects.size})`}
        </Button>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Objects */}
        <div className="w-1/2 overflow-y-auto border-r border-border p-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("workspace.selectObjects")}
          </h2>
          <div className="space-y-1.5">
            {objects.map((obj) => (
              <ObjectRow
                key={obj.path}
                item={obj}
                selected={selectedObjects.has(obj.path)}
                onToggle={handleToggleObject(obj.path)}
              />
            ))}
          </div>
        </div>

        {/* Right: Pipelines */}
        <div className="w-1/2 overflow-y-auto p-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("workspace.selectPipeline")}
          </h2>
          {pipelines.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-10 text-center">
              <Layers className="h-8 w-8 text-muted-foreground/30" />
              <p className="mt-2 text-sm text-muted-foreground">{t("workspace.noPipelines")}</p>
              <Button
                className="mt-3 h-auto p-0 text-xs"
                variant="link"
                onClick={handleNavigatePipelines}
              >
                {t("workspace.createPipeline")}
              </Button>
            </div>
          ) : (
            <div className="space-y-1.5">
              {pipelines.map((p) => (
                <PipelineRow
                  key={p.id}
                  pipeline={p}
                  selected={p.id === selectedPipelineId}
                  onSelect={handleSelectPipeline(p.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom summary bar */}
      {(selectedObjects.size > 0 || selectedPipeline) && (
        <div className="shrink-0 border-t border-border bg-background px-6 py-3">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {t("workspace.objectsCount", { count: selectedObjects.size })}
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium text-foreground">
              {selectedPipeline?.name ?? t("workspace.noPipelineSelected")}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

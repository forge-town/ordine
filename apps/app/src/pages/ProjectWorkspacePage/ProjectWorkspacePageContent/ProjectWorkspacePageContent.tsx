import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  FolderGit2,
  ChevronRight,
  Play,
  GitBranch,
  Layers,
} from "lucide-react";
import { Route } from "@/routes/projects.$projectId.workspace";
import { createWork } from "@/services/worksService";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/button";
import { ObjectRow } from "../ObjectRow";
import { PipelineRow } from "../PipelineRow";
import type { ObjectItem } from "../ObjectRow";

const buildObjectTree = (owner: string, repo: string): ObjectItem[] => [
  { type: "project", path: "/", label: `${owner}/${repo} (整个项目)` },
  { type: "folder", path: "src/", label: "src/" },
  { type: "folder", path: "src/pages/", label: "src/pages/" },
  { type: "folder", path: "src/components/", label: "src/components/" },
  { type: "file", path: "src/index.ts", label: "src/index.ts" },
  { type: "file", path: "package.json", label: "package.json" },
];

export const ProjectWorkspacePageContent = () => {
  const { project, pipelines } = Route.useLoaderData();
  const navigate = useNavigate();

  const [selectedObjects, setSelectedObjects] = useState<Set<string>>(
    new Set(),
  );
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(
    null,
  );
  const [triggering, setTriggering] = useState(false);

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        项目不存在
      </div>
    );
  }

  const objects = buildObjectTree(project.owner, project.repo);
  const selectedPipeline = pipelines.find((p) => p.id === selectedPipelineId);

  const toggleObject = (path: string) => {
    setSelectedObjects((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const canTrigger =
    selectedObjects.size > 0 && selectedPipelineId !== null && !triggering;

  const handleTrigger = async () => {
    if (!canTrigger || !selectedPipeline) return;
    setTriggering(true);
    try {
      for (const path of selectedObjects) {
        const obj = objects.find((o) => o.path === path)!;
        await createWork({
          data: {
            id: `work-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            projectId: project.id,
            pipelineId: selectedPipeline.id,
            pipelineName: selectedPipeline.name,
            object: { type: obj.type, path: obj.path },
          },
        });
      }
      void navigate({
        to: "/projects/$projectId",
        params: { projectId: project.id },
      });
    } finally {
      setTriggering(false);
    }
  };

  const handleNavigateBack = () =>
    void navigate({
      to: "/projects/$projectId",
      params: { projectId: project.id },
    });

  const handleTriggerClick = () => void handleTrigger();

  const handleToggleObject = (path: string) => () => toggleObject(path);

  const handleNavigatePipelines = () => void navigate({ to: "/pipelines" });

  const handleSelectPipeline = (id: string) => () =>
    setSelectedPipelineId(id === selectedPipelineId ? null : id);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-6">
        <Button
          className="h-8 w-8"
          size="icon"
          variant="ghost"
          onClick={handleNavigateBack}
        >
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold text-foreground truncate">
            工作区
          </h1>
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
          触发 Work {selectedObjects.size > 0 && `(${selectedObjects.size})`}
        </Button>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Objects */}
        <div className="w-1/2 overflow-y-auto border-r border-border p-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            选择对象 (Object)
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
            选择 Pipeline
          </h2>
          {pipelines.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-10 text-center">
              <Layers className="h-8 w-8 text-muted-foreground/30" />
              <p className="mt-2 text-sm text-muted-foreground">
                还没有 Pipeline
              </p>
              <Button
                className="mt-3 h-auto p-0 text-xs"
                variant="link"
                onClick={handleNavigatePipelines}
              >
                去创建
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
              {selectedObjects.size} 个对象
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium text-foreground">
              {selectedPipeline?.name ?? "— 未选 Pipeline"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

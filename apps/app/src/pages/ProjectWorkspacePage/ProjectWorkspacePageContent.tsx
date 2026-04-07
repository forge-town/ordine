import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  FileCode,
  Folder,
  FolderGit2,
  ChevronRight,
  Play,
  GitBranch,
  CheckCircle2,
  Circle,
  Layers,
} from "lucide-react";
import { Route } from "@/routes/projects.$projectId.workspace";
import { createWork } from "@/services/worksService";
import type { WorkObject } from "@/models/daos/worksDao";
import type { PipelineEntity } from "@/models/daos/pipelinesDao";
import { cn } from "@repo/ui/lib/utils";

type ObjectItem = {
  type: WorkObject["type"];
  path: string;
  label: string;
};

const buildObjectTree = (owner: string, repo: string): ObjectItem[] => {
  return [
    { type: "project", path: "/", label: `${owner}/${repo} (整个项目)` },
    { type: "folder", path: "src/", label: "src/" },
    { type: "folder", path: "src/pages/", label: "src/pages/" },
    { type: "folder", path: "src/components/", label: "src/components/" },
    { type: "file", path: "src/index.ts", label: "src/index.ts" },
    { type: "file", path: "package.json", label: "package.json" },
  ];
};

const OBJECT_ICONS: Record<WorkObject["type"], React.ElementType> = {
  project: FolderGit2,
  folder: Folder,
  file: FileCode,
};

const ObjectRow = ({
  item,
  selected,
  onToggle,
}: {
  item: ObjectItem;
  selected: boolean;
  onToggle: () => void;
}) => {
  const Icon = OBJECT_ICONS[item.type];
  const handleToggle = () => onToggle();
  return (
    <button
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
        selected
          ? "border-violet-300 bg-violet-50"
          : "border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50"
      )}
      onClick={handleToggle}
    >
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded",
          item.type === "project" && "bg-gray-900",
          item.type === "folder" && "bg-orange-400",
          item.type === "file" && "bg-orange-500"
        )}
      >
        <Icon className="h-3.5 w-3.5 text-white" />
      </span>
      <span className="flex-1 truncate font-mono text-xs text-gray-700">{item.label}</span>
      {selected ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-violet-500" />
      ) : (
        <Circle className="h-4 w-4 shrink-0 text-gray-300" />
      )}
    </button>
  );
};

const PipelineRow = ({
  pipeline,
  selected,
  onSelect,
}: {
  pipeline: PipelineEntity;
  selected: boolean;
  onSelect: () => void;
}) => {
  const handleSelect = () => onSelect();
  return (
    <button
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
        selected
          ? "border-violet-300 bg-violet-50"
          : "border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50"
      )}
      onClick={handleSelect}
    >
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded",
          selected ? "bg-violet-600" : "bg-violet-100"
        )}
      >
        <Layers className={cn("h-3.5 w-3.5", selected ? "text-white" : "text-violet-500")} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="truncate text-xs font-medium text-gray-800">{pipeline.name}</p>
        {pipeline.description && (
          <p className="truncate text-[10px] text-gray-400">{pipeline.description}</p>
        )}
      </div>
      <ChevronRight
        className={cn(
          "h-3.5 w-3.5 shrink-0 transition-colors",
          selected ? "text-violet-500" : "text-gray-300"
        )}
      />
    </button>
  );
};

export const ProjectWorkspacePageContent = () => {
  const { project, pipelines } = Route.useLoaderData();
  const navigate = useNavigate();

  const [selectedObjects, setSelectedObjects] = useState<Set<string>>(new Set());
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
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

  const canTrigger = selectedObjects.size > 0 && selectedPipelineId !== null && !triggering;

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
    <div className="flex h-full flex-col overflow-hidden bg-gray-50">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-6">
        <button
          className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
          onClick={handleNavigateBack}
        >
          <ArrowLeft className="h-4 w-4 text-gray-500" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold text-gray-900 truncate">工作区</h1>
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <FolderGit2 className="h-3 w-3" />
            <span>
              {project.owner}/{project.repo}
            </span>
            <GitBranch className="ml-1 h-3 w-3" />
            <span>{project.branch}</span>
          </div>
        </div>
        {/* Trigger button */}
        <button
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
            canTrigger
              ? "bg-violet-600 text-white hover:bg-violet-700"
              : "cursor-not-allowed bg-gray-100 text-gray-400"
          )}
          disabled={!canTrigger}
          onClick={handleTriggerClick}
        >
          <Play className="h-3.5 w-3.5" />
          触发 Work {selectedObjects.size > 0 && `(${selectedObjects.size})`}
        </button>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Objects */}
        <div className="w-1/2 overflow-y-auto border-r border-gray-200 p-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
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
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
            选择 Pipeline
          </h2>
          {pipelines.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white py-10 text-center">
              <Layers className="h-8 w-8 text-gray-300" />
              <p className="mt-2 text-sm text-gray-400">还没有 Pipeline</p>
              <button
                className="mt-3 text-xs text-violet-600 hover:underline"
                onClick={handleNavigatePipelines}
              >
                去创建
              </button>
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
        <div className="shrink-0 border-t border-gray-200 bg-white px-6 py-3">
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="font-medium text-gray-700">{selectedObjects.size} 个对象</span>
            <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
            <span className="font-medium text-gray-700">
              {selectedPipeline?.name ?? "— 未选 Pipeline"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

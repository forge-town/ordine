import { Cpu, File, Folder, FolderGit2, MessageSquareText, Upload, Workflow } from "lucide-react";
import type { TFunction } from "i18next";
import type { Operation, PipelineAsset } from "@repo/schemas";
import type { ComponentCardItem } from "./ComponentCard";

export const createBuiltinItems = (t: TFunction): ComponentCardItem[] => [
  {
    id: "builtin-folder",
    category: "input",
    description: t("components.builtins.folder.description"),
    icon: Folder,
    io: "directory -> files[]",
    meta: "local-fs",
    name: t("components.builtins.folder.name"),
    source: "builtin",
    stat: t("components.stats.builtin"),
  },
  {
    id: "builtin-file",
    category: "input",
    description: t("components.builtins.file.description"),
    icon: File,
    io: "path -> file",
    meta: "local-fs",
    name: t("components.builtins.file.name"),
    source: "builtin",
    stat: t("components.stats.builtin"),
  },
  {
    id: "builtin-github-project",
    category: "input",
    description: t("components.builtins.githubProject.description"),
    icon: FolderGit2,
    io: "repository -> files[]",
    meta: "github",
    name: t("components.builtins.githubProject.name"),
    source: "builtin",
    stat: t("components.stats.builtin"),
  },
  {
    id: "builtin-prompt",
    category: "input",
    description: t("components.builtins.prompt.description"),
    icon: MessageSquareText,
    io: "text -> prompt",
    meta: "text",
    name: t("components.builtins.prompt.name"),
    source: "builtin",
    stat: t("components.stats.builtin"),
  },
  {
    id: "builtin-local-path",
    category: "output",
    description: t("components.builtins.localPath.description"),
    icon: Upload,
    io: "artifact -> local path",
    meta: "local output",
    name: t("components.builtins.localPath.name"),
    source: "builtin",
    stat: t("components.stats.builtin"),
  },
  {
    id: "builtin-project-path",
    category: "output",
    description: t("components.builtins.projectPath.description"),
    icon: Upload,
    io: "artifact -> project path",
    meta: "project output",
    name: t("components.builtins.projectPath.name"),
    source: "builtin",
    stat: t("components.stats.builtin"),
  },
];

export const toOperationItem = (operation: Operation, t: TFunction): ComponentCardItem => {
  const executorType = operation.config.executor?.type;
  const outputCount = operation.config.outputs?.length ?? 0;

  return {
    id: operation.id,
    category: "operation",
    description: operation.description || t("components.fallbacks.operationDescription"),
    icon: Cpu,
    io: `${operation.acceptedObjectTypes.join(" | ")} -> ${outputCount || "output"}`,
    meta:
      executorType === "script"
        ? t("components.meta.scriptOperation")
        : t("components.meta.agentOperation"),
    name: operation.name,
    source: "operation",
    stat: t("components.stats.accepts", { count: operation.acceptedObjectTypes.length }),
    canDelete: true,
    canEdit: true,
  };
};

export const toAssetItem = (asset: PipelineAsset, t: TFunction): ComponentCardItem => ({
  id: asset.id,
  category: "pipeline-skill",
  description: asset.description || t("components.fallbacks.assetDescription"),
  icon: Workflow,
  io: `${asset.inputSlots.length} ${t("components.stats.inputs")} -> pipeline`,
  meta: t("components.stats.nodes", { count: asset.snapshotNodes.length }),
  name: asset.name,
  source: "asset",
  stat: t("components.stats.runs", { count: asset.totalRuns }),
  canDelete: true,
  canEdit: true,
});

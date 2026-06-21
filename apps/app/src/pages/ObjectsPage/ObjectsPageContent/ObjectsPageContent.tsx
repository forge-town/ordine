import { Box, Globe, FolderGit2, Puzzle, ChevronRight, File, Folder } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ElementType } from "react";
import { Link } from "@tanstack/react-router";
import { pluginRegistry, type ObjectTypeDefinition } from "@repo/plugin";
import { PageHeader } from "@/components/PageHeader";

const iconMap: Record<string, ElementType> = {
  globe: Globe,
  github: FolderGit2,
  box: Box,
  puzzle: Puzzle,
  file: File,
  folder: Folder,
};

const builtinObjectTypes: Pick<ObjectTypeDefinition, "id" | "label" | "icon">[] = [
  { id: "files", label: "文件", icon: "file" },
  { id: "folders", label: "文件夹", icon: "folder" },
];

export const ObjectsPageContent = () => {
  const { t } = useTranslation();
  const pluginObjectTypes = pluginRegistry.getAllObjectTypes();

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader icon={<Box className="h-4 w-4 text-primary" />} title={t("objects.title")} />

      <div className="flex-1 overflow-y-auto p-6">
        <p className="mb-6 text-sm text-muted-foreground">{t("objects.subtitle")}</p>

        <div className="grid gap-4">
          {builtinObjectTypes.map((objType) => {
            const Icon = iconMap[objType.icon ?? ""] ?? Puzzle;

            return (
              <div key={objType.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-medium">{objType.label}</h3>
                    <p className="text-xs text-muted-foreground">{objType.id}</p>
                  </div>
                </div>
              </div>
            );
          })}

          {pluginObjectTypes.map((objType) => {
            const Icon = iconMap[objType.icon ?? ""] ?? Puzzle;

            return (
              <Link
                key={objType.id}
                className="block rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent"
                params={{ objectTypeId: objType.id }}
                to="/pipelines/objects/$objectTypeId"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-medium">{objType.label}</h3>
                    <p className="text-xs text-muted-foreground">{objType.id}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};

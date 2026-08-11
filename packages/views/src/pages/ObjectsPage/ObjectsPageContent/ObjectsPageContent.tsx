import { Box, Globe, FolderGit2, Puzzle, ChevronRight, File, Folder } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ElementType } from "react";
import { Link } from "@tanstack/react-router";
import { pluginRegistry, type ObjectTypeDefinition } from "@repo/plugin";
import { surfaceCardVariants } from "@repo/ui/card";
import { cn } from "@repo/ui/lib/utils";
import { PageHeader } from "../../../components/PageHeader";

const iconMap: Record<string, ElementType> = {
  globe: Globe,
  github: FolderGit2,
  box: Box,
  puzzle: Puzzle,
  file: File,
  folder: Folder,
};

const builtinObjectTypes: (Pick<ObjectTypeDefinition, "id" | "icon"> & { labelKey: string })[] = [
  { id: "files", labelKey: "objects.files", icon: "file" },
  { id: "folders", labelKey: "objects.folders", icon: "folder" },
];

export const ObjectsPageContent = () => {
  const { t } = useTranslation();
  const pluginObjectTypes = pluginRegistry.getAllObjectTypes();

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        eyebrow={t("nav.groups.assembly")}
        icon={<Box className="h-4 w-4 text-primary" />}
        sub={t("objects.subtitle")}
        title={t("objects.title")}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-4 sm:px-7">
        <div className="grid gap-3">
          {builtinObjectTypes.map((objType) => {
            const Icon = iconMap[objType.icon ?? ""] ?? Puzzle;

            return (
              <div key={objType.id} className={cn(surfaceCardVariants(), "p-3.5")}>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-medium">{t(objType.labelKey)}</h3>
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
                className={cn(
                  surfaceCardVariants({ interactive: true }),
                  "block p-3.5 hover:bg-accent/40",
                )}
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

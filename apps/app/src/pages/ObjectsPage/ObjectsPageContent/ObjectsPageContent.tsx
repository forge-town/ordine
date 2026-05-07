import { Box, Globe, FolderGit2, Puzzle } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ElementType } from "react";
import { Badge } from "@repo/ui/badge";
import { pluginRegistry } from "@repo/plugin";
import { PageHeader } from "@/components/PageHeader";

const iconMap: Record<string, ElementType> = {
  globe: Globe,
  github: FolderGit2,
  box: Box,
  puzzle: Puzzle,
};

export const ObjectsPageContent = () => {
  const { t } = useTranslation();
  const objectTypes = pluginRegistry.getAllObjectTypes();

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader icon={<Box className="h-4 w-4 text-primary" />} title={t("objects.title")} />

      <div className="flex-1 overflow-y-auto p-6">
        <p className="mb-6 text-sm text-muted-foreground">{t("objects.subtitle")}</p>

        {objectTypes.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("objects.noObjects")}</p>
        ) : (
          <div className="grid gap-4">
            {objectTypes.map((objType) => {
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
                    <Badge variant="secondary">{objType.icon ?? "plugin"}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

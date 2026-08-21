import { Folder, File, Ban, RotateCw } from "lucide-react";
import { useList } from "@refinedev/core";
import { useTranslation } from "react-i18next";
import type { DirectoryEntry } from "@repo/schemas";
import { Button } from "@repo/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { ResourceName } from "../../../constants";

interface FolderTreePreviewProps {
  folderPath: string;
  excludedPaths: string[];
  onExclude: (relativePath: string) => void;
}

const handleStopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

export const FolderTreePreview = ({
  folderPath,
  excludedPaths,
  onExclude,
}: FolderTreePreviewProps) => {
  const { t } = useTranslation();
  const { query } = useList<DirectoryEntry>({
    resource: ResourceName.filesystem,
    filters: folderPath ? [{ field: "path", operator: "eq", value: folderPath }] : [],
    queryOptions: { enabled: !!folderPath },
  });

  const entries = query.data?.data ?? [];
  const loading = query.isLoading;

  if (!folderPath) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-1 px-1 py-1 text-[10px] text-muted-foreground">
        <RotateCw className="h-3 w-3 animate-spin" />
        {t("canvas.folderTreeLoading")}
      </div>
    );
  }

  if (entries.length === 0) return null;

  return (
    <div
      className="nodrag nopan max-h-32 overflow-y-auto rounded-md bg-surface-2/60 px-1 py-0.5 ring-1 ring-border"
      onMouseDown={handleStopPropagation}
    >
      {entries.map((entry) => {
        const isExcluded = excludedPaths.includes(entry.name);
        const handleExclude = () => onExclude(entry.name);

        return (
          <div
            key={entry.name}
            className="group/entry flex items-center gap-1 rounded px-1 py-0.5 text-[10px] transition-colors hover:bg-muted"
            data-excluded={isExcluded}
          >
            {entry.type === "directory" ? (
              <Folder className="h-3 w-3 shrink-0 text-muted-foreground" />
            ) : (
              <File className="h-3 w-3 shrink-0 text-muted-foreground" />
            )}
            <span
              className={cn(
                "flex-1 truncate font-mono",
                isExcluded ? "text-muted-foreground/60 line-through" : "text-muted-foreground",
              )}
            >
              {entry.name}
            </span>
            {!isExcluded && entry.type === "directory" && (
              <Button
                aria-label={t("canvas.excludePath", { name: entry.name })}
                className="nodrag nopan h-auto rounded p-0.5 text-red-500 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-700 group-hover/entry:opacity-100 dark:hover:text-red-300"
                size="icon-xs"
                type="button"
                variant="ghost"
                onClick={handleExclude}
              >
                <Ban className="h-2.5 w-2.5" />
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
};

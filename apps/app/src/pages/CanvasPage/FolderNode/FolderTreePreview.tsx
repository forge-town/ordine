import { Folder, File, Ban, RotateCw } from "lucide-react";
import { useList } from "@refinedev/core";
import { Button } from "@repo/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { ResourceName } from "@/integrations/refine/dataProvider";

interface DirectoryEntry {
  name: string;
  type: "file" | "directory";
  path: string;
}

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
      <div className="flex items-center gap-1 px-1 py-1 text-[10px] text-slate-400">
        <RotateCw className="h-3 w-3 animate-spin" />
        加载中…
      </div>
    );
  }

  if (entries.length === 0) return null;

  return (
    <div
      className="nodrag nopan max-h-32 overflow-y-auto rounded-md border border-slate-100 bg-slate-50/50 px-1 py-0.5"
      onMouseDown={handleStopPropagation}
    >
      {entries.map((entry) => {
        const isExcluded = excludedPaths.includes(entry.name);
        const handleExclude = () => onExclude(entry.name);
        return (
          <div
            key={entry.name}
            className="group/entry flex items-center gap-1 rounded px-1 py-0.5 text-[10px] hover:bg-slate-100 transition-colors"
            data-excluded={isExcluded}
          >
            {entry.type === "directory" ? (
              <Folder className="h-3 w-3 shrink-0 text-orange-400" />
            ) : (
              <File className="h-3 w-3 shrink-0 text-slate-400" />
            )}
            <span
              className={cn(
                "flex-1 truncate font-mono",
                isExcluded ? "line-through text-slate-400" : "text-slate-600"
              )}
            >
              {entry.name}
            </span>
            {!isExcluded && entry.type === "directory" && (
              <Button
                aria-label={`排除 ${entry.name}`}
                className="nodrag nopan opacity-0 group-hover/entry:opacity-100 rounded p-0.5 text-red-400 hover:bg-red-100 hover:text-red-600 transition-all h-auto"
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

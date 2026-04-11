import { useState } from "react";
import { useList } from "@refinedev/core";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@repo/ui/dialog";
import { Button } from "@repo/ui/button";
import { ScrollArea } from "@repo/ui/scroll-area";
import { Folder, FileCode, ChevronRight, Home, ArrowUp } from "lucide-react";
import { ResourceName } from "@/integrations/refine/dataProvider";

interface DirectoryEntry {
  name: string;
  type: "file" | "directory";
  path: string;
}

export interface FolderBrowserProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (path: string) => void;
  /** "folder" = only show dirs + select current dir (default); "file" = show dirs+files, select a file */
  mode?: "folder" | "file";
}

export const FolderBrowser = ({
  open,
  onOpenChange,
  onSelect,
  mode = "folder",
}: FolderBrowserProps) => {
  const { t } = useTranslation();
  const [currentPath, setCurrentPath] = useState<string | undefined>(undefined);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const { query } = useList<DirectoryEntry>({
    resource: ResourceName.filesystem,
    filters: currentPath ? [{ field: "path", operator: "eq", value: currentPath }] : [],
    queryOptions: { enabled: open },
  });

  const allEntries = query.data?.data ?? [];
  const entries =
    mode === "file" ? allEntries : allEntries.filter((e: DirectoryEntry) => e.type === "directory");

  const displayPath = currentPath ?? "~";

  const handleNavigate = (path: string) => {
    setCurrentPath(path);
    setSelectedFile(null);
  };

  const handleGoUp = () => {
    if (!currentPath) return;
    const parent = currentPath.split("/").slice(0, -1).join("/") || "/";
    setCurrentPath(parent);
    setSelectedFile(null);
  };

  const handleGoHome = () => {
    setCurrentPath(undefined);
    setSelectedFile(null);
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setCurrentPath(undefined);
      setSelectedFile(null);
    }
    onOpenChange(v);
  };

  const handleConfirm = () => {
    if (mode === "file" && selectedFile) {
      onSelect(selectedFile);
    } else {
      onSelect(currentPath ?? "");
    }
    onOpenChange(false);
  };

  const handleFileClick = (entry: DirectoryEntry) => {
    if (entry.type === "directory") {
      handleNavigate(entry.path);
    } else {
      setSelectedFile(entry.path);
    }
  };

  const handleCancel = () => onOpenChange(false);

  const handleSegmentClick = (fullPath: string | undefined) => {
    if (fullPath) handleNavigate(fullPath);
  };

  const pathSegments = displayPath === "~" ? ["~"] : displayPath.split("/").filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "file"
              ? t("nodes.outputLocalPath.selectFile")
              : t("nodes.outputLocalPath.selectFolder")}
          </DialogTitle>
          <DialogDescription>
            {mode === "file"
              ? t("nodes.outputLocalPath.browseFileDesc")
              : t("nodes.outputLocalPath.browseFolderDesc")}
          </DialogDescription>
        </DialogHeader>

        {/* Breadcrumb / Path bar */}
        <div className="flex items-center gap-1 rounded-md border bg-muted/50 px-2 py-1.5 text-xs font-mono overflow-x-auto">
          <button
            className="shrink-0 p-0.5 rounded hover:bg-accent"
            type="button"
            onClick={handleGoHome}
          >
            <Home className="h-3.5 w-3.5" />
          </button>
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
          {pathSegments.map((seg, i) => {
            const fullPath =
              displayPath === "~" ? undefined : "/" + pathSegments.slice(0, i + 1).join("/");
            return (
              <span key={`${seg}-${i}`} className="flex items-center gap-1">
                <button
                  className="shrink-0 truncate max-w-[120px] rounded px-1 hover:bg-accent hover:text-accent-foreground"
                  type="button"
                  onClick={() => handleSegmentClick(fullPath)}
                >
                  {seg}
                </button>
                {i < pathSegments.length - 1 && (
                  <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                )}
              </span>
            );
          })}
        </div>

        {/* Directory listing */}
        <ScrollArea className="h-[280px] rounded-md border">
          {query.isLoading && (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              {t("nodes.outputLocalPath.loading")}
            </div>
          )}
          {query.isError && (
            <div className="flex items-center justify-center h-full text-sm text-destructive">
              {query.error?.message ?? t("nodes.outputLocalPath.loadFailed")}
            </div>
          )}
          {!query.isLoading && !query.isError && (
            <div className="p-1">
              {currentPath && (
                <button
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent"
                  type="button"
                  onClick={handleGoUp}
                >
                  <ArrowUp className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">..</span>
                </button>
              )}
              {entries.map((entry) => (
                <button
                  key={entry.path}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent ${
                    selectedFile === entry.path ? "bg-accent ring-1 ring-teal-400" : ""
                  }`}
                  type="button"
                  onClick={() => handleFileClick(entry)}
                >
                  {entry.type === "directory" ? (
                    <Folder className="h-3.5 w-3.5 shrink-0 text-teal-500" />
                  ) : (
                    <FileCode className="h-3.5 w-3.5 shrink-0 text-orange-500" />
                  )}
                  <span className="truncate">{entry.name}</span>
                </button>
              ))}
              {entries.length === 0 && !query.isLoading && (
                <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
                  {t("nodes.outputLocalPath.emptyFolder")}
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Current selection display */}
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-xs">
          <span className="text-teal-600 font-medium">
            {t("nodes.outputLocalPath.currentSelection")}
          </span>
          <span className="font-mono text-teal-800">
            {mode === "file" && selectedFile ? selectedFile : displayPath}
          </span>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            {t("common.cancel")}
          </Button>
          <Button disabled={mode === "file" && !selectedFile} onClick={handleConfirm}>
            {mode === "file"
              ? t("nodes.outputLocalPath.selectThisFile")
              : t("nodes.outputLocalPath.selectThisFolder")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

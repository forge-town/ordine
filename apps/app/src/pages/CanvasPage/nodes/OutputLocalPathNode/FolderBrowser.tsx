import { useState, useCallback, useEffect } from "react";
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
import { Folder, ChevronRight, Home, ArrowUp } from "lucide-react";

interface DirectoryEntry {
  name: string;
  type: "file" | "directory";
  path: string;
}

export interface FolderBrowserProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (path: string) => void;
}

export const FolderBrowser = ({ open, onOpenChange, onSelect }: FolderBrowserProps) => {
  const [currentPath, setCurrentPath] = useState("");
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchEntries = useCallback(async (dirPath?: string) => {
    setLoading(true);
    setError("");
    const url = dirPath
      ? `/api/filesystem/browse?path=${encodeURIComponent(dirPath)}`
      : "/api/filesystem/browse";

    const response = await fetch(url);
    if (!response.ok) {
      const body = (await response.json()) as { error: string };
      setError(body.error);
      setLoading(false);
      return;
    }

    const data = (await response.json()) as DirectoryEntry[];
    const dirs = data.filter((e) => e.type === "directory");
    setEntries(dirs);
    setCurrentPath(dirPath ?? "~");
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) {
      void fetchEntries();
    }
  }, [open, fetchEntries]);

  const handleNavigate = (path: string) => {
    void fetchEntries(path);
  };

  const handleGoUp = () => {
    if (currentPath === "~") return;
    const parent = currentPath.split("/").slice(0, -1).join("/") || "/";
    void fetchEntries(parent);
  };

  const handleGoHome = () => {
    void fetchEntries();
  };

  const handleOpenChange = (v: boolean) => onOpenChange(v);

  const handleConfirm = () => {
    onSelect(currentPath === "~" ? "" : currentPath);
    onOpenChange(false);
  };

  const handleCancel = () => onOpenChange(false);

  const handleSegmentClick = (fullPath: string | undefined) => {
    if (fullPath) handleNavigate(fullPath);
  };

  const pathSegments = currentPath === "~" ? ["~"] : currentPath.split("/").filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>选择文件夹</DialogTitle>
          <DialogDescription>浏览并选择输出目录</DialogDescription>
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
              currentPath === "~" ? undefined : "/" + pathSegments.slice(0, i + 1).join("/");
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
          {loading && (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              加载中...
            </div>
          )}
          {error && (
            <div className="flex items-center justify-center h-full text-sm text-destructive">
              {error}
            </div>
          )}
          {!loading && !error && (
            <div className="p-1">
              {currentPath !== "~" && (
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
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent"
                  type="button"
                  onClick={() => handleNavigate(entry.path)}
                >
                  <Folder className="h-3.5 w-3.5 shrink-0 text-teal-500" />
                  <span className="truncate">{entry.name}</span>
                </button>
              ))}
              {entries.length === 0 && !loading && (
                <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
                  空文件夹
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Current selection display */}
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-xs">
          <span className="text-teal-600 font-medium">当前选择：</span>
          <span className="font-mono text-teal-800">{currentPath}</span>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            取消
          </Button>
          <Button onClick={handleConfirm}>选择此文件夹</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

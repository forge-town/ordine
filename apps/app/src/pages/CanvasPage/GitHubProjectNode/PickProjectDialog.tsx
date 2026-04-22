import { useState } from "react";
import { Search, GitBranch, Lock, Globe, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useList } from "@refinedev/core";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@repo/ui/dialog";
import { ResourceName } from "@/integrations/refine/dataProvider";
import type { GithubProject } from "@repo/schemas";

export interface PickedProject {
  githubProjectId: string;
  owner: string;
  repo: string;
  branch: string;
  description: string;
  label: string;
  githubUrl: string;
  isPrivate: boolean;
}

interface PickProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onPick: (project: PickedProject) => void;
}

export const PickProjectDialog = ({ open, onClose, onPick }: PickProjectDialogProps) => {
  const { query } = useList<GithubProject>({
    resource: ResourceName.githubProjects,
    queryOptions: { enabled: open },
  });
  const projects = query.data?.data ?? [];
  const loading = query.isLoading;
  const [search, setSearch] = useState("");

  const filtered = projects.filter(
    (p) =>
      p.owner.toLowerCase().includes(search.toLowerCase()) ||
      p.repo.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase())
  );

  const handlePick = (p: GithubProject) => {
    onPick({
      githubProjectId: p.id,
      owner: p.owner,
      repo: p.repo,
      branch: p.branch,
      description: p.description,
      label: p.repo,
      githubUrl: p.githubUrl,
      isPrivate: (p as GithubProject & { isPrivate?: boolean }).isPrivate ?? false,
    });
    onClose();
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) onClose();
  };
  const { t } = useTranslation();
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("canvas.pickRepoTitle")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* 搜索 */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              className="w-full rounded-md border bg-muted/30 py-1.5 pl-8 pr-3 text-sm focus:bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder={t("canvas.searchRepo")}
              value={search}
              onChange={handleSearchChange}
            />
          </div>

          {/* 项目列表 */}
          <div className="max-h-72 overflow-y-auto space-y-1">
            {loading && (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                加载中...
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {projects.length === 0
                  ? "项目库为空，请先在「项目」页面连接 GitHub 仓库"
                  : "未找到匹配的项目"}
              </div>
            )}

            {!loading &&
              filtered.map((p) => (
                <button
                  key={p.id}
                  className="w-full rounded-lg border border-transparent px-3 py-2.5 text-left hover:border-border hover:bg-muted/50 transition-colors"
                  type="button"
                  onClick={() => handlePick(p)}
                >
                  <div className="flex items-center gap-2">
                    {p.githubUrl.includes("private") ? (
                      <Lock className="h-3.5 w-3.5 shrink-0 text-orange-400" />
                    ) : (
                      <Globe className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                    )}
                    <span className="font-mono text-sm font-semibold">
                      {p.owner}/{p.repo}
                    </span>
                    <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
                      <GitBranch className="h-3 w-3" />
                      {p.branch}
                    </span>
                  </div>
                  {p.description && (
                    <div className="mt-0.5 truncate pl-5 text-xs text-muted-foreground">
                      {p.description}
                    </div>
                  )}
                </button>
              ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

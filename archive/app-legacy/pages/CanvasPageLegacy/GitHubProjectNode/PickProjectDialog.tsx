import { useState } from "react";
import { Search, GitBranch, Lock, Globe, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useList } from "@refinedev/core";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@repo/ui/dialog";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
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
      p.description.toLowerCase().includes(search.toLowerCase()),
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
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              className="bg-muted/30 pl-8"
              placeholder={t("canvas.searchRepo")}
              value={search}
              onChange={handleSearchChange}
            />
          </div>

          {/* Project list */}
          <div className="max-h-72 overflow-y-auto space-y-1">
            {loading && (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("common.loading")}
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {projects.length === 0
                  ? t("github.projectListEmpty")
                  : t("github.projectListNoResults")}
              </div>
            )}

            {!loading &&
              filtered.map((p) => (
                <Button
                  key={p.id}
                  className="flex h-auto w-full flex-col items-stretch gap-0 rounded-lg border border-transparent px-3 py-2.5 text-left hover:border-border"
                  type="button"
                  variant="ghost"
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
                </Button>
              ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

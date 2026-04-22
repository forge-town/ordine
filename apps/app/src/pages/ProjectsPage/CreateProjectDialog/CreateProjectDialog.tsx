import { useState } from "react";
import { GitBranch, X, Link2, Loader2, AlertCircle, Key, Lock, Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { parseGitHubUrl, fetchRepoInfo, type GitHubRepoInfo } from "@/lib/githubApi";
import { useGithubToken } from "@/hooks/useGithubToken";
import { GitHubTokenDialog } from "@/pages/CanvasPage/GitHubProjectNode/GitHubTokenDialog";
import { useCreate } from "@refinedev/core";
import { ResourceName } from "@/integrations/refine/dataProvider";
import type { GithubProject } from "@repo/schemas";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { ResultAsync } from "neverthrow";

export type CreateProjectDialogProps = {
  onClose: () => void;
  onCreate: (p: GithubProject) => void;
};

export const CreateProjectDialog = ({ onClose, onCreate }: CreateProjectDialogProps) => {
  const { t } = useTranslation();
  const { token } = useGithubToken();
  const { mutateAsync: createProjectMutate } = useCreate();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repoInfo, setRepoInfo] = useState<GitHubRepoInfo | null>(null);
  const [saving, setSaving] = useState(false);
  const [showTokenDialog, setShowTokenDialog] = useState(false);

  const handleFetch = async () => {
    const parsed = parseGitHubUrl(url.trim());
    if (!parsed) {
      setError(t("projects.invalidUrl"));

      return;
    }
    setLoading(true);
    setError(null);
    const result = await fetchRepoInfo(parsed.owner, parsed.repo, token ?? undefined);
    result.match(
      (info) => setRepoInfo(info),
      (errorMsg) => setError(errorMsg)
    );
    setLoading(false);
  };

  const handleSave = async () => {
    if (!repoInfo) return;
    setSaving(true);
    const result = await ResultAsync.fromPromise(
      createProjectMutate({
        resource: ResourceName.githubProjects,
        values: {
          id: `proj-${Date.now()}`,
          name: repoInfo.fullName,
          description: repoInfo.description ?? "",
          owner: repoInfo.owner,
          repo: repoInfo.repo,
          branch: repoInfo.branch,
          githubUrl: `https://github.com/${repoInfo.fullName}`,
          isPrivate: repoInfo.isPrivate ?? false,
        },
      }),
      (e) => (e instanceof Error ? e.message : t("projects.saveFailed"))
    );
    result.match(
      (response) => {
        onCreate(response.data as GithubProject);
        onClose();
      },
      (errorMsg) => setError(errorMsg)
    );
    setSaving(false);
  };

  const handleOpenTokenDialog = () => setShowTokenDialog(true);
  const handleCloseTokenDialog = () => setShowTokenDialog(false);
  const handleReset = () => {
    setRepoInfo(null);
    setError(null);
  };
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value);
    setError(null);
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") void handleFetch();
  };
  const handleClose = () => onClose();
  const handleSaveClick = () => void handleSave();
  const handleFetchClick = () => void handleFetch();

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-2xl bg-card shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold text-foreground">
              {t("projects.connectProjectTitle")}
            </h2>
            <Button className="h-7 w-7" size="icon" variant="ghost" onClick={handleClose}>
              <X className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>

          <div className="p-5 space-y-4">
            <div
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-xs",
                token ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
              )}
            >
              <Key className="h-3.5 w-3.5 shrink-0" />
              {token ? (
                <span>{t("projects.tokenConfigured")}</span>
              ) : (
                <span>
                  {t("projects.tokenMissing")}
                  <button
                    className="ml-1 underline underline-offset-2"
                    onClick={handleOpenTokenDialog}
                  >
                    {t("projects.configureToken")}
                  </button>
                </span>
              )}
            </div>

            {repoInfo ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-border bg-muted/50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-foreground">
                      {repoInfo.fullName}
                    </span>
                    {repoInfo.isPrivate ? (
                      <span className="flex items-center gap-0.5 rounded-full bg-gray-200 px-2 py-0.5 text-[10px] text-gray-600">
                        <Lock className="h-2.5 w-2.5" /> Private
                      </span>
                    ) : (
                      <span className="flex items-center gap-0.5 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] text-blue-600">
                        <Globe className="h-2.5 w-2.5" /> Public
                      </span>
                    )}
                  </div>
                  {repoInfo.description && (
                    <p className="text-xs text-muted-foreground mb-2">{repoInfo.description}</p>
                  )}
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <GitBranch className="h-3 w-3" />
                    {repoInfo.branch}
                  </div>
                </div>
                {error && (
                  <div className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {error}
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={handleReset}>
                    {t("projects.resetInput")}
                  </Button>
                  <Button disabled={saving} onClick={handleSaveClick}>
                    {saving ? t("common.saving") : t("projects.addToLibrary")}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t("projects.githubUrl")}
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Link2 className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        className="pl-8 text-sm"
                        placeholder="https://github.com/owner/repo"
                        value={url}
                        onChange={handleUrlChange}
                        onKeyDown={handleKeyDown}
                      />
                    </div>
                    <Button disabled={loading || !url.trim()} size="sm" onClick={handleFetchClick}>
                      {loading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        t("projects.fetch")
                      )}
                    </Button>
                  </div>
                </div>
                {error && (
                  <div className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {error}
                  </div>
                )}
              </div>
            )}

            {repoInfo === null && (
              <div className="flex justify-end">
                <Button variant="outline" onClick={handleClose}>
                  {t("common.cancel")}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
      {showTokenDialog && (
        <GitHubTokenDialog open={showTokenDialog} onClose={handleCloseTokenDialog} />
      )}
    </>
  );
};

import { useState } from "react";
import { Link2, Loader2, AlertCircle, Lock, Globe, Key } from "lucide-react";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@repo/ui/dialog";
import { parseGitHubUrl, fetchRepoInfo, type GitHubRepoInfo } from "@/lib/githubApi";
import { useGithubToken } from "@/hooks/useGithubToken";
import { GitHubTokenDialog } from "./GitHubTokenDialog";

export interface ConnectedRepoInfo {
  owner: string;
  repo: string;
  branch: string;
  description: string;
  label: string;
}

interface GitHubConnectDialogProps {
  open: boolean;
  onClose: () => void;
  onConnect: (info: ConnectedRepoInfo) => void;
  initialUrl?: string;
}

export const GitHubConnectDialog = ({
  open,
  onClose,
  onConnect,
  initialUrl = "",
}: GitHubConnectDialogProps) => {
  const { token } = useGithubToken();
  const [url, setUrl] = useState(initialUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repoInfo, setRepoInfo] = useState<GitHubRepoInfo | null>(null);
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [step, setStep] = useState<"input" | "confirm">("input");

  const handleFetch = async () => {
    if (!url.trim()) return;
    setError(null);
    setLoading(true);

    try {
      const parsed = parseGitHubUrl(url);
      if (!parsed) {
        throw new Error("无法解析 GitHub URL，请输入完整的仓库链接");
      }

      const info = await fetchRepoInfo(parsed.owner, parsed.repo, token, parsed.branch);
      setRepoInfo(info);
      setStep("confirm");
    } catch (error) {
      setError(error instanceof Error ? error.message : "获取仓库信息失败");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!repoInfo) return;
    onConnect({
      owner: repoInfo.owner,
      repo: repoInfo.repo,
      branch: repoInfo.branch,
      description: repoInfo.description,
      label: repoInfo.repo,
    });
    handleClose();
  };

  const handleClose = () => {
    setUrl(initialUrl);
    setStep("input");
    setRepoInfo(null);
    setError(null);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !loading) handleFetch();
  };
  const handleOpenChange = (v: boolean) => {
    if (!v) handleClose();
  };
  const handleOpenTokenDialog = () => setTokenDialogOpen(true);
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value);
  const handleGoToInput = () => setStep("input");
  const handleTokenDialogClose = () => setTokenDialogOpen(false);

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              连接 GitHub 仓库
            </DialogTitle>
          </DialogHeader>

          {step === "input" && (
            <div className="space-y-4">
              {/* Token 状态提示 */}
              <div
                className={`flex items-center justify-between rounded-md px-3 py-2 text-xs ${
                  token ? "bg-green-50 text-green-700" : "bg-orange-50 text-orange-700"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Key className="h-3.5 w-3.5" />
                  {token ? "已配置 Token（可访问私有仓库）" : "未配置 Token（仅可访问公开仓库）"}
                </div>
                <button
                  className="font-medium underline underline-offset-2 hover:no-underline"
                  type="button"
                  onClick={handleOpenTokenDialog}
                >
                  {token ? "修改" : "配置"}
                </button>
              </div>

              {/* URL 输入 */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">GitHub 仓库 URL</label>
                <div className="flex gap-2">
                  <Input
                    className="font-mono text-sm"
                    placeholder="https://github.com/owner/repo"
                    value={url}
                    onChange={handleUrlChange}
                    onKeyDown={handleKeyDown}
                  />
                  <Button disabled={!url.trim() || loading} size="sm" onClick={handleFetch}>
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Link2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground">
                  支持格式：https://github.com/owner/repo 或
                  https://github.com/owner/repo/tree/branch
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-xs text-destructive">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {error}
                </div>
              )}
            </div>
          )}

          {step === "confirm" && repoInfo && (
            <div className="space-y-4">
              {/* 仓库预览 */}
              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  {repoInfo.isPrivate ? (
                    <Lock className="h-4 w-4 text-orange-500" />
                  ) : (
                    <Globe className="h-4 w-4 text-blue-500" />
                  )}
                  <span className="font-mono text-sm font-semibold">{repoInfo.fullName}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {repoInfo.isPrivate ? "Private" : "Public"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">分支</span>
                    <div className="font-mono font-medium">{repoInfo.branch}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">默认分支</span>
                    <div className="font-mono font-medium">{repoInfo.defaultBranch}</div>
                  </div>
                </div>

                {repoInfo.description && (
                  <div className="text-xs text-muted-foreground border-t pt-2">
                    {repoInfo.description}
                  </div>
                )}
              </div>

              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="outline" onClick={handleGoToInput}>
                  返回
                </Button>
                <Button size="sm" onClick={handleConfirm}>
                  连接仓库
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <GitHubTokenDialog open={tokenDialogOpen} onClose={handleTokenDialogClose} />
    </>
  );
};

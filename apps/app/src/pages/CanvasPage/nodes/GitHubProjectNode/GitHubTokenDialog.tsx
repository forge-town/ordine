import { useState, useEffect } from "react";
import { Key, Eye, EyeOff, ExternalLink, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@repo/ui/dialog";
import { verifyGitHubToken } from "@/lib/githubApi";
import { useGithubToken } from "@/hooks/useGithubToken";

interface GitHubTokenDialogProps {
  open: boolean;
  onClose: () => void;
  onTokenSaved?: (token: string | null) => void;
}

export const GitHubTokenDialog = ({ open, onClose, onTokenSaved }: GitHubTokenDialogProps) => {
  const { token: savedToken, setToken } = useGithubToken();
  const [inputValue, setInputValue] = useState(savedToken ?? "");
  const [showToken, setShowToken] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifiedLogin, setVerifiedLogin] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setInputValue(savedToken ?? "");
      setVerifiedLogin(null);
      setVerifyError(null);
    }
  }, [open, savedToken]);

  const handleVerify = async () => {
    setVerifying(true);
    setVerifyError(null);
    setVerifiedLogin(null);
    const result = await verifyGitHubToken(inputValue);
    setVerifying(false);
    if (result.valid) {
      setVerifiedLogin(result.login);
    } else {
      const msg = result.error.includes(":") ? result.error.split(":")[1] : result.error;
      setVerifyError(msg ?? result.error);
    }
  };

  const handleSave = () => {
    const trimmed = inputValue.trim() || null;
    setToken(trimmed);
    onTokenSaved?.(trimmed);
    onClose();
  };

  const handleClear = () => {
    setToken(null);
    onTokenSaved?.(null);
    onClose();
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) onClose();
  };
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setVerifiedLogin(null);
    setVerifyError(null);
  };
  const handleToggleShowToken = () => setShowToken((v) => !v);
  const handleClose = onClose;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-4 w-4 text-primary" />
            GitHub Personal Access Token
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 当前状态 */}
          <div
            className={`flex items-start gap-2 rounded-lg p-3 text-sm ${
              savedToken
                ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                : "bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400"
            }`}
          >
            {savedToken ? (
              <>
                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <div className="font-medium">Token 已配置</div>
                  <div className="opacity-80">可访问私有仓库</div>
                </div>
              </>
            ) : (
              <>
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <div className="font-medium">未配置 Token</div>
                  <div className="mt-0.5">访问私有仓库需要填写 Personal Access Token</div>
                </div>
              </>
            )}
          </div>

          {/* Token 输入 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Personal Access Token</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showToken ? "text" : "password"}
                  value={inputValue}
                  onChange={handleInputChange}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  className="pr-8 font-mono text-sm"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={handleToggleShowToken}
                >
                  {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleVerify}
                disabled={!inputValue.trim() || verifying}
              >
                {verifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "验证"}
              </Button>
            </div>

            {/* 验证结果 */}
            {verifiedLogin && (
              <div className="flex items-center gap-1.5 text-xs text-green-600">
                <CheckCircle className="h-3.5 w-3.5" />
                验证成功，已登录为 <strong>{verifiedLogin}</strong>
              </div>
            )}
            {verifyError && (
              <div className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5" />
                {verifyError}
              </div>
            )}
          </div>

          {/* 说明 */}
          <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
            <div>Token 仅保存在本地浏览器，不会上传至服务器</div>
            <a
              href="https://github.com/settings/tokens/new?scopes=repo&description=Ordine"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />在 GitHub 创建 Token（需勾选 repo 权限）
            </a>
          </div>

          {/* 操作按钮 */}
          <div className="flex justify-between">
            {savedToken && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={handleClear}
              >
                清除 Token
              </Button>
            )}
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={handleClose}>
                取消
              </Button>
              <Button size="sm" onClick={handleSave} disabled={!inputValue.trim()}>
                保存
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

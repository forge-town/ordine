import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Key, Eye, EyeOff, ExternalLink, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@repo/ui/dialog";
import { verifyGitHubToken } from "@/lib/githubApi";
import { useGithubToken } from "@/hooks/useGithubToken";

interface GitHubTokenDialogProps {
  open: boolean;
  onClose: () => void;
  onTokenSaved?: (token: string | null) => void;
}

export const GitHubTokenDialog = ({ open, onClose, onTokenSaved }: GitHubTokenDialogProps) => {
  const handleOpenChange = (v: boolean) => {
    if (!v) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {open && (
        <GitHubTokenDialogContent
          handleClose={() => onClose()}
          handleTokenSaved={onTokenSaved ? (t) => onTokenSaved(t) : undefined}
        />
      )}
    </Dialog>
  );
};

const GitHubTokenDialogContent = ({
  handleClose,
  handleTokenSaved,
}: {
  handleClose: () => void;
  handleTokenSaved?: (token: string | null) => void;
}) => {
  const { t } = useTranslation();
  const { token: savedToken, setToken } = useGithubToken();
  const [inputValue, setInputValue] = useState(savedToken ?? "");
  const [showToken, setShowToken] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifiedLogin, setVerifiedLogin] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

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
    handleTokenSaved?.(trimmed);
    handleClose();
  };

  const handleClear = () => {
    setToken(null);
    handleTokenSaved?.(null);
    handleClose();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setVerifiedLogin(null);
    setVerifyError(null);
  };
  const handleToggleShowToken = () => setShowToken((v) => !v);

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Key className="h-4 w-4 text-primary" />
          {t("github.tokenTitle")}
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        {/* Current token state */}
        <div
          className={cn(
            "flex items-start gap-2 rounded-lg p-3 text-sm",
            savedToken
              ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400"
              : "bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400",
          )}
        >
          {savedToken ? (
            <>
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="font-medium">{t("github.tokenStatusConfigured")}</div>
                <div className="opacity-80">{t("github.tokenPrivateAccess")}</div>
              </div>
            </>
          ) : (
            <>
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="font-medium">{t("github.tokenStatusMissing")}</div>
                <div className="mt-0.5">{t("github.tokenPrivateRequiresPat")}</div>
              </div>
            </>
          )}
        </div>

        {/* Token input */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">{t("github.personalAccessToken")}</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                className="pr-8 font-mono text-sm"
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                type={showToken ? "text" : "password"}
                value={inputValue}
                onChange={handleInputChange}
              />
              <Button
                aria-label={showToken ? t("github.hideToken") : t("github.showToken")}
                className="absolute right-2 top-1/2 h-auto -translate-y-1/2 p-0 text-muted-foreground hover:text-foreground"
                type="button"
                variant="ghost"
                onClick={handleToggleShowToken}
              >
                {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
            </div>
            <Button
              disabled={!inputValue.trim() || verifying}
              size="sm"
              variant="outline"
              onClick={handleVerify}
            >
              {verifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("github.verify")}
            </Button>
          </div>

          {/* Verification result */}
          {verifiedLogin && (
            <div className="flex items-center gap-1.5 text-xs text-green-600">
              <CheckCircle className="h-3.5 w-3.5" />
              <Trans
                components={{ strong: <strong /> }}
                i18nKey="github.verifySuccess"
                values={{ login: verifiedLogin }}
              />
            </div>
          )}
          {verifyError && (
            <div className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />
              {verifyError}
            </div>
          )}
        </div>

        {/* Token storage note */}
        <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
          <div>{t("github.tokenLocalOnly")}</div>
          <a
            className="inline-flex items-center gap-1 text-primary hover:underline"
            href="https://github.com/settings/tokens/new?scopes=repo&description=Ordine"
            rel="noopener noreferrer"
            target="_blank"
          >
            <ExternalLink className="h-3 w-3" />
            {t("github.createTokenLink")}
          </a>
        </div>

        {/* Actions */}
        <div className="flex justify-between">
          {savedToken && (
            <Button
              className="text-destructive hover:text-destructive"
              size="sm"
              variant="ghost"
              onClick={handleClear}
            >
              {t("github.clearToken")}
            </Button>
          )}
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={handleClose}>
              {t("common.cancel")}
            </Button>
            <Button disabled={!inputValue.trim()} size="sm" onClick={handleSave}>
              {t("common.save")}
            </Button>
          </div>
        </div>
      </div>
    </DialogContent>
  );
};

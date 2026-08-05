import { RotateCcw, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ProposeActionsErrorCode } from "@repo/schemas";
import { Icon } from "../../../../components/primitives";

export type ErrorActionsProps = {
  code: ProposeActionsErrorCode;
  disabled?: boolean;
  onOpenSettings: () => void;
  onRetry: () => void;
};

/**
 * Inline recovery actions for a failed propose round (PRD principle 5:
 * "how to fix" must be clickable, not plain text).
 */
export const ErrorActions = ({
  code,
  disabled = false,
  onOpenSettings,
  onRetry,
}: ErrorActionsProps) => {
  const { t } = useTranslation();
  const isRuntimeIssue = code === "RUNTIME_NOT_FOUND";

  return (
    <div className="flex items-center gap-1.5 pl-3" data-testid="agent-error-actions">
      <button
        className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11.5px] font-medium text-foreground underline decoration-border-strong underline-offset-2 transition-colors hover:bg-accent/50 disabled:cursor-not-allowed disabled:opacity-50"
        data-testid={isRuntimeIssue ? "agent-error-open-settings" : "agent-error-retry"}
        disabled={disabled}
        type="button"
        onClick={isRuntimeIssue ? onOpenSettings : onRetry}
      >
        <Icon icon={isRuntimeIssue ? Settings : RotateCcw} size={12} />
        {isRuntimeIssue
          ? t("canvas.agentPanel.errorActions.openSettings")
          : t("canvas.agentPanel.errorActions.retry")}
      </button>
    </div>
  );
};

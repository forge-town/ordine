import { useTranslation } from "react-i18next";

export type ErrorCardProps = {
  title: string;
  tryLabel: string;
  what: string;
  why: string;
  onAction?: () => void;
};

/** Minimal error message — bold problem, plain why, clickable fix when available. */
export const ErrorCard = ({ onAction, title, tryLabel, what, why }: ErrorCardProps) => {
  const { t } = useTranslation();

  return (
    <div className="text-[12px] leading-relaxed text-foreground/90" data-testid="agent-error">
      <strong>{title}</strong> — {what} {why}{" "}
      {onAction ? (
        <button
          className="font-medium underline decoration-foreground/30 underline-offset-2 hover:decoration-foreground"
          data-testid="agent-error-action"
          type="button"
          onClick={onAction}
        >
          {tryLabel}
        </button>
      ) : (
        <span className="text-muted-foreground">
          {t("canvas.agentPanel.error.tryPrefix")} {tryLabel}
        </span>
      )}
    </div>
  );
};

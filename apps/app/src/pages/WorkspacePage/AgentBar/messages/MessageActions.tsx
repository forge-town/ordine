import { useState } from "react";
import { Check, Copy, PencilLine, RotateCcw, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@repo/ui/lib/utils";

export type MessageActionsProps = {
  align?: "left" | "right";
  content: string;
  disabled?: boolean;
  /** Load the message back into the composer for editing. */
  onEdit?: () => void;
  /** Re-send the message as-is. */
  onRetry?: () => void;
};

type ActionEntry = {
  icon: LucideIcon;
  id: string;
  labelKey: string;
  onClick: () => void;
};

/**
 * Claude-style hover actions under a message turn. Hidden until the turn is
 * hovered (relies on the surrounding `group/turn` wrapper).
 */
export const MessageActions = ({
  align = "right",
  content,
  disabled = false,
  onEdit,
  onRetry,
}: MessageActionsProps) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard?.writeText(content).then(() => {
      setCopied(true);
      globalThis.setTimeout(() => setCopied(false), 1500);
    });
  };

  const entries: ActionEntry[] = [
    {
      icon: copied ? Check : Copy,
      id: "copy",
      labelKey: copied
        ? "workspace.agentBar.messageActions.copied"
        : "workspace.agentBar.messageActions.copy",
      onClick: handleCopy,
    },
    ...(onEdit
      ? [
          {
            icon: PencilLine,
            id: "edit",
            labelKey: "workspace.agentBar.messageActions.edit",
            onClick: onEdit,
          },
        ]
      : []),
    ...(onRetry
      ? [
          {
            icon: RotateCcw,
            id: "retry",
            labelKey: "workspace.agentBar.messageActions.retry",
            onClick: onRetry,
          },
        ]
      : []),
  ];

  return (
    <div
      className={cn(
        "flex items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover/turn:opacity-100 group-focus-within/turn:opacity-100",
        align === "right" ? "justify-end" : "justify-start",
      )}
      data-testid="agent-message-actions"
    >
      {entries.map((entry) => (
        <button
          key={entry.id}
          aria-label={t(entry.labelKey)}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
          data-testid={`agent-message-action-${entry.id}`}
          disabled={disabled && entry.id !== "copy"}
          title={t(entry.labelKey)}
          type="button"
          onClick={entry.onClick}
        >
          <entry.icon className="h-3 w-3" />
        </button>
      ))}
    </div>
  );
};

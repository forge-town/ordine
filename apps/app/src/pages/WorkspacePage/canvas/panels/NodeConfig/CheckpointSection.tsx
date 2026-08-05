import { Flag } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@repo/ui/lib/utils";
import type { NodeConfigSectionProps } from "./types";

export const CheckpointSection = ({ node, onPatch }: NodeConfigSectionProps) => {
  const { t } = useTranslation();
  const isOperation = node.data.nodeType === "operation";
  const checked = node.data.nodeType === "operation" ? Boolean(node.data.checkpoint) : false;
  const handleToggle = () => onPatch({ checkpoint: !checked });

  return (
    <section className="space-y-2 rounded-xl bg-muted/60 p-3 ring-1 ring-border">
      <div className="flex items-center gap-2">
        <Flag className="size-3.5 text-muted-foreground" />
        <h3 className="text-xs font-semibold">
          {t("workspace.canvas.nodeConfig.checkpoint.title")}
        </h3>
      </div>
      <button
        aria-pressed={checked}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-xl bg-card px-2.5 py-2 text-left ring-1 ring-border",
          !isOperation && "cursor-not-allowed opacity-50",
        )}
        data-testid="node-config-checkpoint"
        disabled={!isOperation}
        type="button"
        onClick={handleToggle}
      >
        <span
          className={cn(
            "flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors",
            checked ? "bg-foreground" : "bg-muted-foreground/30",
          )}
        >
          <span
            className={cn(
              "size-4 rounded-full bg-background transition-transform",
              checked && "translate-x-4",
            )}
          />
        </span>
        <span className="flex-1 text-xs">
          <span className="font-medium">
            {t("workspace.canvas.nodeConfig.checkpoint.pauseForReview")}
          </span>{" "}
          <span className="text-muted-foreground">
            {t("workspace.canvas.nodeConfig.checkpoint.afterStep")}
          </span>
        </span>
      </button>
    </section>
  );
};

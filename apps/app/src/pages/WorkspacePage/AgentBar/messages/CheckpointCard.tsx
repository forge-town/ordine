import { Flag, Pause, Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { Icon } from "@/components/primitives";

export type CheckpointCardProps = {
  isWaiting: boolean;
  nodeLabel?: string;
  onPause: () => void;
  onResume: () => void;
};

/** Minimal run-control row — status line + two small inline buttons. */
export const CheckpointCard = ({
  isWaiting,
  nodeLabel,
  onPause,
  onResume,
}: CheckpointCardProps) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-1.5" data-testid="agent-checkpoint">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Icon className={isWaiting ? "text-foreground" : undefined} icon={Flag} size={11} />
        <span className="truncate">
          {isWaiting
            ? t("workspace.agentBar.checkpoint.waiting", {
                node: nodeLabel ?? t("workspace.agentBar.checkpoint.nextNode"),
              })
            : t("workspace.agentBar.checkpoint.controls")}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <Button
          className="h-6 rounded-lg px-2 text-[11px]"
          data-testid="agent-checkpoint-pause"
          disabled={isWaiting}
          size="sm"
          type="button"
          variant="outline"
          onClick={onPause}
        >
          <Pause className="size-3" />
          {t("workspace.agentBar.checkpoint.pause")}
        </Button>
        <Button
          className="h-6 rounded-lg px-2 text-[11px]"
          data-testid="agent-checkpoint-resume"
          disabled={!isWaiting}
          size="sm"
          type="button"
          onClick={onResume}
        >
          <Play className="size-3 fill-current" />
          {t("workspace.agentBar.checkpoint.resume")}
        </Button>
      </div>
    </div>
  );
};

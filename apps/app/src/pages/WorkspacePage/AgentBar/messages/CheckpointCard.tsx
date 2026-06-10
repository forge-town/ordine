import { Pause, Play, ShieldCheck } from "lucide-react";
import { Button } from "@repo/ui/button";
import { Icon } from "@/components/primitives";
import { Card } from "./Card";

export type CheckpointCardProps = {
  isWaiting: boolean;
  nodeLabel?: string;
  onPause: () => void;
  onResume: () => void;
};

export const CheckpointCard = ({
  isWaiting,
  nodeLabel,
  onPause,
  onResume,
}: CheckpointCardProps) => {
  const label = nodeLabel ?? "next node";

  return (
    <Card>
      <div className="space-y-2.5 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md status-wash-warning">
            <Icon icon={ShieldCheck} size={13} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-semibold">
              {isWaiting ? "Checkpoint waiting" : "Run controls"}
            </div>
            <div className="truncate text-[10px] text-muted-foreground">
              {isWaiting ? `Paused at ${label}` : "Pause after the current step"}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            disabled={isWaiting}
            size="sm"
            type="button"
            variant="secondary"
            onClick={onPause}
          >
            <Pause className="h-3.5 w-3.5" />
            Pause
          </Button>
          <Button disabled={!isWaiting} size="sm" type="button" onClick={onResume}>
            <Play className="h-3.5 w-3.5" />
            Resume
          </Button>
        </div>
      </div>
    </Card>
  );
};

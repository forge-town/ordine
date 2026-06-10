import { Dot } from "@/components/primitives";
import { Card } from "./Card";

export type RunStatusCardProps = {
  costLabel?: string;
  isLive?: boolean;
  subtitle: string;
  title: string;
};

export const RunStatusCard = ({
  costLabel,
  isLive = true,
  subtitle,
  title,
}: RunStatusCardProps) => {
  return (
    <Card>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <Dot ping={isLive} tone={isLive ? "muted" : "success"} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-semibold">{title}</div>
          <div className="truncate text-[10px] text-muted-foreground">{subtitle}</div>
        </div>
        {costLabel ? (
          <span className="shrink-0 font-mono text-[10.5px] text-muted-foreground">
            {costLabel}
          </span>
        ) : null}
      </div>
    </Card>
  );
};

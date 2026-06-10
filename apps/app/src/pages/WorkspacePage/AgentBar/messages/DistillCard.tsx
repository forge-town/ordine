import { Sparkles } from "lucide-react";
import { Button } from "@repo/ui/button";
import { Icon } from "@/components/primitives";
import { Card } from "./Card";

export type DistillCardProps = {
  onOpen?: () => void;
  subtitle: string;
  title: string;
};

export const DistillCard = ({ onOpen, subtitle, title }: DistillCardProps) => {
  const handleOpenClick = () => onOpen?.();

  return (
    <Card className="bg-surface ring-foreground/15">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-foreground text-primary-foreground">
          <Icon icon={Sparkles} size={12} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-semibold">{title}</div>
          <div className="truncate text-[10px] text-muted-foreground">{subtitle}</div>
        </div>
        <Button
          className="h-7 rounded-lg px-2 text-[11px]"
          size="sm"
          variant="secondary"
          onClick={handleOpenClick}
        >
          Open
        </Button>
      </div>
    </Card>
  );
};

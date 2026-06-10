import { ChevronDown, ChevronRight, Plus, Wand2 } from "lucide-react";
import { Button } from "@repo/ui/button";
import { Icon } from "@/components/primitives";
import { Card } from "./Card";

export type ProposalItem = {
  detail: string;
  title: string;
};

export type ProposalCardProps = {
  items: ProposalItem[];
  onApply?: () => void;
  onReject?: () => void;
  onRevise?: () => void;
  open?: boolean;
  subtitle: string;
  title: string;
};

export const ProposalCard = ({
  items,
  onApply,
  onReject,
  onRevise,
  open = true,
  subtitle,
  title,
}: ProposalCardProps) => {
  const ToggleIcon = open ? ChevronDown : ChevronRight;
  const handleApplyClick = () => onApply?.();
  const handleReviseClick = () => onRevise?.();
  const handleRejectClick = () => onReject?.();

  return (
    <Card>
      <div className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-surface ring-1 ring-border">
          <Icon icon={Wand2} size={13} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-semibold">{title}</div>
          <div className="truncate text-[10px] text-muted-foreground">{subtitle}</div>
        </div>
        <Icon className="text-muted-foreground" icon={ToggleIcon} size={14} />
      </div>
      {open ? (
        <div className="border-t border-border/70 px-3 py-2.5">
          <ul className="space-y-1.5 text-[11px]">
            {items.map((item) => (
              <li key={item.title} className="flex items-start gap-2">
                <Icon className="mt-0.5 shrink-0 text-foreground/55" icon={Plus} size={12} />
                <div className="min-w-0">
                  <span className="font-medium">{item.title}</span>
                  <span className="ml-1 text-muted-foreground">{item.detail}</span>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center gap-1.5">
            <Button
              className="h-7 flex-1 rounded-xl text-[12px]"
              size="sm"
              onClick={handleApplyClick}
            >
              Apply
            </Button>
            <Button
              className="h-7 flex-1 rounded-xl text-[12px]"
              size="sm"
              variant="secondary"
              onClick={handleReviseClick}
            >
              Revise
            </Button>
            <Button
              className="h-7 rounded-xl px-2.5 text-[12px]"
              size="sm"
              variant="ghost"
              onClick={handleRejectClick}
            >
              Reject
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
};

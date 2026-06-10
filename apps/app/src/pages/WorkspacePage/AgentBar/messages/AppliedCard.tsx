import { Check } from "lucide-react";
import { Icon } from "@/components/primitives";
import { Card } from "./Card";

export type AppliedCardProps = {
  detail: string;
  title: string;
};

export const AppliedCard = ({ detail, title }: AppliedCardProps) => {
  return (
    <Card>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-md status-wash-success">
          <Icon icon={Check} size={13} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-semibold">{title}</div>
          <div className="truncate text-[10px] text-muted-foreground">{detail}</div>
        </div>
      </div>
    </Card>
  );
};

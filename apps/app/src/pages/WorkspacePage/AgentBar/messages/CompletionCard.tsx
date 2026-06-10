import { CircleCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Icon } from "@/components/primitives";
import { Card } from "./Card";

export type CompletionCardProps = {
  children: ReactNode;
  subtitle: string;
  title: string;
};

export const CompletionCard = ({ children, subtitle, title }: CompletionCardProps) => {
  return (
    <Card>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-md status-wash-success">
          <Icon icon={CircleCheck} size={13} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-semibold">{title}</div>
          <div className="truncate text-[10px] text-muted-foreground">{subtitle}</div>
        </div>
      </div>
      <div className="border-t border-border/70 px-3 py-2.5 text-[11.5px] leading-relaxed text-foreground/85">
        {children}
      </div>
    </Card>
  );
};

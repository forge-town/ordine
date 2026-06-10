import type { ReactNode } from "react";
import { cn } from "@repo/ui/lib/utils";

export type BubbleProps = {
  children: ReactNode;
  className?: string;
  attachmentLabel?: string;
};

export const Bubble = ({ attachmentLabel, children, className }: BubbleProps) => {
  return (
    <div className="flex justify-end">
      <div
        className={cn(
          "max-w-[88%] rounded-2xl rounded-br-md bg-foreground px-3 py-2 text-[12px] leading-relaxed text-primary-foreground",
          className,
        )}
      >
        {attachmentLabel ? (
          <div className="mb-1 text-[10.5px] font-medium opacity-80">{attachmentLabel}</div>
        ) : null}
        {children}
      </div>
    </div>
  );
};

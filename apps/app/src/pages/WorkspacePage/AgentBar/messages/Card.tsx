import type { PropsWithChildren } from "react";
import { cn } from "@repo/ui/lib/utils";

export type CardProps = PropsWithChildren<{
  className?: string;
}>;

export const Card = ({ children, className }: CardProps) => {
  return (
    <div className={cn("overflow-hidden rounded-2xl bg-surface-2 ring-1 ring-border", className)}>
      {children}
    </div>
  );
};

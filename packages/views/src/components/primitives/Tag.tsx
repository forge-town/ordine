import type { ReactNode } from "react";
import { cn } from "@repo/ui/lib/utils";

export type TagProps = {
  children: ReactNode;
  className?: string;
};

export const Tag = ({ children, className }: TagProps) => (
  <span
    className={cn(
      "rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-foreground/70",
      className,
    )}
  >
    {children}
  </span>
);

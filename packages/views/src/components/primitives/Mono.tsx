import type { ReactNode } from "react";
import { cn } from "@repo/ui/lib/utils";

export type MonoProps = {
  children: ReactNode;
  className?: string;
};

export const Mono = ({ children, className }: MonoProps) => (
  <span
    className={cn(
      "flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 font-mono text-xs font-bold",
      className,
    )}
  >
    {children}
  </span>
);

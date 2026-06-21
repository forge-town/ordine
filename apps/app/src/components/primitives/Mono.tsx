import type { ReactNode } from "react";
import { cn } from "@repo/ui/lib/utils";

export type MonoProps = {
  children: ReactNode;
  className?: string;
};

export const Mono = ({ children, className }: MonoProps) => {
  return (
    <span
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-[12px] font-bold",
        className,
      )}
    >
      {children}
    </span>
  );
};

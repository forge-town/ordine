import type { ReactNode } from "react";
import { cn } from "@repo/ui/lib/utils";

export type ChipProps = {
  active?: boolean;
  children: ReactNode;
  className?: string;
  count?: number;
  onClick?: () => void;
};

export const Chip = ({ active = false, children, className, count, onClick }: ChipProps) => {
  const handleClick = () => {
    onClick?.();
  };
  const content = (
    <>
      {children}
      {count === undefined ? null : (
        <span
          className={cn(
            "rounded-full px-1.5 text-[10px]",
            active ? "bg-surface text-foreground" : "bg-surface-2",
          )}
        >
          {count}
        </span>
      )}
    </>
  );
  const classes = cn(
    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] transition-colors",
    active
      ? "bg-accent text-foreground"
      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
    className,
  );

  if (onClick) {
    return (
      <button className={classes} type="button" onClick={handleClick}>
        {content}
      </button>
    );
  }

  return <span className={classes}>{content}</span>;
};

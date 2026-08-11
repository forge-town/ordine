import type { ReactNode } from "react";
import { surfaceCardVariants } from "@repo/ui/card";
import { cn } from "@repo/ui/lib/utils";

export type PageStateProps = {
  action?: ReactNode;
  className?: string;
  description?: ReactNode;
  icon?: ReactNode;
  title: ReactNode;
};

export const PageState = ({ action, className, description, icon, title }: PageStateProps) => (
  <div
    className={cn(
      surfaceCardVariants(),
      "grid min-h-48 place-items-center bg-surface-2/35 px-5 py-12 text-center shadow-none",
      className,
    )}
    data-testid="page-state"
  >
    <div className="max-w-sm">
      {icon ? (
        <div className="mx-auto flex size-10 items-center justify-center rounded-lg bg-surface text-muted-foreground shadow-soft ring-1 ring-border [&_svg]:size-4">
          {icon}
        </div>
      ) : null}
      <p className="mt-3 text-[13px] font-medium text-foreground">{title}</p>
      {description ? (
        <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  </div>
);

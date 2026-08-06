import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@repo/ui/lib/utils";
import { buttonVariants } from "@repo/ui/button";

export type PageHeaderProps = {
  actions?: ReactNode;
  backTo?: string;
  badge?: ReactNode;
  children?: ReactNode;
  className?: string;
  eyebrow?: ReactNode;
  icon?: ReactNode;
  sub?: ReactNode;
  title: string;
};

export const PageHeader = ({
  actions,
  backTo,
  badge,
  children,
  className,
  eyebrow,
  icon,
  sub,
  title,
}: PageHeaderProps) => {
  const backIcon = backTo ? (
    <a
      className={buttonVariants({ className: "h-8 w-8", size: "icon", variant: "ghost" })}
      href={backTo}
    >
      <ArrowLeft className="h-4 w-4 text-muted-foreground" />
    </a>
  ) : (
    icon
  );

  if (children || (!eyebrow && !sub)) {
    return (
      <div
        className={cn(
          "flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background py-0 pl-6 pr-16",
          className,
        )}
      >
        {backIcon}
        {children ?? (
          <>
            <div className={cn("min-w-0", actions || badge ? "flex-1" : undefined)}>
              <h1 className="truncate text-base font-semibold text-foreground">{title}</h1>
            </div>
            {badge}
            {actions ? <div className="ml-auto flex items-center gap-2">{actions}</div> : null}
          </>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 flex-col items-stretch gap-4 border-b border-border bg-background px-4 pb-4 pt-4 sm:flex-row sm:items-start sm:justify-between sm:px-7 sm:pt-6",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {backIcon}
        <div className="min-w-0">
          {eyebrow ? (
            <div className="mb-1 text-[10.5px] font-medium uppercase text-muted-foreground">
              {eyebrow}
            </div>
          ) : null}
          <div className="flex min-w-0 items-center gap-2">
            {!backIcon && icon ? <span className="shrink-0">{icon}</span> : null}
            <h1 className="truncate text-[21px] font-semibold leading-tight text-foreground">
              {title}
            </h1>
          </div>
          {sub ? (
            <p className="mt-1 max-w-xl text-[12.5px] leading-relaxed text-muted-foreground">
              {sub}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        {badge}
        {actions}
      </div>
    </div>
  );
};

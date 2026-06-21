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

  if (children) {
    return (
      <div
        className={cn(
          "flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-6",
          className,
        )}
      >
        {backIcon}
        {children}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-start justify-between gap-4 border-b border-border bg-background px-7 pb-4 pt-6",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {backIcon}
        <div className="min-w-0">
          {eyebrow ? (
            <div className="mb-1 text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
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
      <div className="flex shrink-0 items-center gap-2">
        {badge}
        {actions}
      </div>
    </div>
  );
};

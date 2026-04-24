import { ArrowLeft } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { buttonVariants } from "@repo/ui/button";

export type PageHeaderProps = {
  actions?: React.ReactNode;
  backTo?: string;
  badge?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
  subtitle?: string;
  title: string;
};

export const PageHeader = ({
  actions,
  backTo,
  badge,
  children,
  className,
  icon,
  subtitle,
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

  return (
    <div
      className={cn(
        "flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-6",
        className
      )}
    >
      {backIcon}
      {children ?? (
        <>
          <div className={cn("min-w-0", actions || badge ? "flex-1" : undefined)}>
            <h1
              className={cn(
                "font-semibold text-foreground",
                subtitle ? "truncate text-sm" : "text-base"
              )}
            >
              {title}
            </h1>
            {subtitle ? (
              <p className="truncate font-mono text-[11px] text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          {badge}
          {actions ? <div className="ml-auto flex items-center gap-2">{actions}</div> : null}
        </>
      )}
    </div>
  );
};

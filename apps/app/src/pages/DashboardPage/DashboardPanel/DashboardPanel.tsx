import { cn } from "@repo/ui/lib/utils";

export type DashboardPanelProps = {
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  description?: string;
  title: string;
};

export const DashboardPanel = ({
  actions,
  children,
  className,
  description,
  title,
}: DashboardPanelProps) => {
  return (
    <section
      className={cn(
        "rounded-[24px] border border-border/80 bg-card/80 p-5 shadow-sm backdrop-blur-sm",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {description ? (
            <p className="max-w-xl text-xs leading-5 text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
};

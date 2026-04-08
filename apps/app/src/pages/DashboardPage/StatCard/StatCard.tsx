import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

export type StatCardProps = {
  icon: React.ElementType;
  label: string;
  value: number | string;
  sub: string;
  to: string;
};

export const StatCard = ({
  icon: Icon,
  label,
  value,
  sub,
  to,
}: StatCardProps) => {
  return (
    <Link to={to as "/"}>
      <div className="group rounded-xl border border-border bg-card px-5 py-4 hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer">
        <div className="flex items-center justify-between">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Icon className="h-4 w-4" />
          </span>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
        </div>
        <p className="mt-3 text-2xl font-bold text-foreground">{value}</p>
        <p className="mt-0.5 text-sm font-medium text-foreground">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
      </div>
    </Link>
  );
};

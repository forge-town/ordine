import { cn } from "@repo/ui/lib/utils";

export type StatCardProps = {
  color: string;
  dot: string;
  label: string;
  value: number;
};

export const StatCard = ({ color, dot, label, value }: StatCardProps) => {
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4">
      <div className="flex items-center gap-2">
        <span className={cn("h-2 w-2 rounded-full", dot)} />
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p className={cn("mt-1 text-2xl font-bold", color)}>{value}</p>
    </div>
  );
};

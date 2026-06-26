import { cn } from "@repo/ui/lib/utils";

export type MetaRowProps = {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
};

export const MetaRow = ({ label, value, mono }: MetaRowProps) => {
  if (!value) return null;

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
      <span className="w-24 shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className={cn("flex-1 text-xs text-foreground break-all", mono && "font-mono")}>
        {value}
      </span>
    </div>
  );
};

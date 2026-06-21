import { cn } from "@repo/ui/lib/utils";
import { formatValue, isComplexValue } from "./inputSnapshotHelpers";

interface SnapshotRowProps {
  label: string;
  value: unknown;
}

export const SnapshotRow = ({ label, value }: SnapshotRowProps) => {
  if (value === null || value === undefined) return null;

  const complex = isComplexValue(value);
  const formatted = formatValue(value);

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
      <span className="w-32 shrink-0 text-xs text-muted-foreground">{label}</span>
      {complex ? (
        <pre className="flex-1 text-xs font-mono text-foreground whitespace-pre-wrap break-all">
          {formatted}
        </pre>
      ) : (
        <span className={cn("flex-1 text-xs text-foreground break-all font-mono")}>
          {formatted}
        </span>
      )}
    </div>
  );
};

import { cn } from "@repo/ui/lib/utils";

interface ToggleProps {
  enabled: boolean;
  onToggle: () => void;
  label: string;
}

export const Toggle = ({ enabled, onToggle, label }: ToggleProps) => {
  const handleToggle = () => onToggle();

  return (
    <div className="flex items-center justify-between rounded-lg border bg-muted/50 px-4 py-3">
      <span className="text-sm">{label}</span>
      <button
        aria-checked={enabled}
        aria-label={label}
        className={cn(
          "relative h-5 w-9 rounded-full transition-colors",
          enabled ? "bg-primary" : "bg-input",
        )}
        role="switch"
        type="button"
        onClick={handleToggle}
      >
        <span
          className={cn(
            "absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-background shadow-sm transition-transform",
            enabled ? "translate-x-4" : "translate-x-0",
          )}
        />
      </button>
    </div>
  );
};

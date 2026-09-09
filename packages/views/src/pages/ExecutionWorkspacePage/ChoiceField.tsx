import { useId } from "react";
import { Label } from "@repo/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
export const ChoiceField = ({
  label,
  value,
  options,
  onChange,
  disabled = false,
  hint,
}: {
  label: string;
  value: string;
  options: ReadonlyArray<{
    value: string;
    label: string;
    disabled?: boolean;
  }>;
  onChange: (value: string) => void;
  disabled?: boolean;
  hint?: string;
}) => {
  const id = useId();
  const handleValueChange1: NonNullable<React.ComponentProps<typeof Select>["onValueChange"]> = (
    next,
  ) => {
    if (next !== null) onChange(String(next));
  };

  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={handleValueChange1}>
        <SelectTrigger className="w-full" disabled={disabled} id={id}>
          <SelectValue>
            {options.find((option) => option.value === value)?.label ?? (value || "请选择")}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} disabled={option.disabled} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
};

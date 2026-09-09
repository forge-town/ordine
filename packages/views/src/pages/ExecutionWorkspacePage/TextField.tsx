import { useId } from "react";
import { Input } from "@repo/ui/input";
import { Textarea } from "@repo/ui/textarea";
import { Label } from "@repo/ui/label";
export const TextField = ({
  label,
  value,
  onChange,
  multiline = false,
  disabled = false,
  hint,
  type = "text",
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  multiline?: boolean;
  disabled?: boolean;
  hint?: string;
  type?: string;
}) => {
  const id = useId();
  const handleChange1: NonNullable<React.ComponentProps<typeof Textarea>["onChange"]> = (event) =>
    onChange(event.target.value);
  const handleChange2: NonNullable<React.ComponentProps<typeof Input>["onChange"]> = (event) =>
    onChange(event.target.value);

  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {multiline ? (
        <Textarea
          className="min-h-24 font-mono text-sm"
          disabled={disabled}
          id={id}
          value={value}
          onChange={handleChange1}
        />
      ) : (
        <Input disabled={disabled} id={id} type={type} value={value} onChange={handleChange2} />
      )}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
};

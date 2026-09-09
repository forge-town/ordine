import { Button } from "@repo/ui/button";
export const ToggleField = ({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) => {
  const handleClick1: NonNullable<React.ComponentProps<typeof Button>["onClick"]> = () =>
    onChange(!checked);

  return (
    <Button
      aria-pressed={checked}
      disabled={disabled}
      size="sm"
      type="button"
      variant={checked ? "default" : "outline"}
      onClick={handleClick1}
    >
      {checked ? "✓ " : ""}
      {label}
    </Button>
  );
};

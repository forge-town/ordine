import { Label } from "@repo/ui/label";

interface FieldProps {
  label: string;
  children: React.ReactNode;
}

export const Field = ({ label, children }: FieldProps) => (
  <div className="space-y-1.5">
    <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {label}
    </Label>
    {children}
  </div>
);

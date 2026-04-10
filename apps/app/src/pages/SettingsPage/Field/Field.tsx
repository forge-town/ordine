import { Label } from "@repo/ui/label";

interface FieldProps {
  label: string;
  children: React.ReactNode;
}

export const Field = ({ label, children }: FieldProps) => (
  <div className="flex flex-col gap-1.5">
    <Label className="text-xs">{label}</Label>
    {children}
  </div>
);

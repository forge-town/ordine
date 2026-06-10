import { TriangleAlert } from "lucide-react";
import { Icon } from "@/components/primitives";

export type ErrorCardProps = {
  title: string;
  what: string;
  why: string;
  tryLabel: string;
};

export const ErrorCard = ({ title, tryLabel, what, why }: ErrorCardProps) => {
  return (
    <div className="rounded-2xl bg-surface-2 p-3 ring-1 ring-border">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium">
        <Icon className="text-destructive" icon={TriangleAlert} size={12} />
        {title}
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        <strong className="text-foreground">What:</strong> {what}
        <br />
        <strong className="text-foreground">Why:</strong> {why}
        <br />
        <strong className="text-foreground">Try:</strong> {tryLabel}
      </p>
    </div>
  );
};

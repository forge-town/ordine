import { Separator } from "@repo/ui/separator";

interface SectionHeaderProps {
  title: string;
  description: string;
}

export const SectionHeader = ({ title, description }: SectionHeaderProps) => (
  <div className="pb-4">
    <h2 className="text-sm font-semibold">{title}</h2>
    <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
    <Separator className="mt-3" />
  </div>
);

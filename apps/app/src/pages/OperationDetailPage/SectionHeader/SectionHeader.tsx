export type SectionHeaderProps = {
  icon: React.ElementType;
  label: string;
};

export const SectionHeader = ({ icon: Icon, label }: SectionHeaderProps) => (
  <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
    <Icon className="h-3.5 w-3.5" />
    {label}
  </div>
);

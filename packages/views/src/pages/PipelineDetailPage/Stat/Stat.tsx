export type StatProps = {
  icon: React.ElementType;
  label: string;
  value: string | number;
};

export const Stat = ({ icon: Icon, label, value }: StatProps) => (
  <div className="flex min-w-0 items-center gap-2.5">
    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted-foreground ring-1 ring-border">
      <Icon className="size-3.5" />
    </div>
    <div className="min-w-0">
      <p className="truncate text-[10.5px] text-muted-foreground">{label}</p>
      <p className="truncate text-[13px] font-semibold text-foreground">{value}</p>
    </div>
  </div>
);

export const GNodeMetaLine = ({ children }: { children: React.ReactNode }) => (
  <div className="truncate text-[10px] text-muted-foreground/85">{children}</div>
);

export const GNodeCodeLine = ({ children }: { children: React.ReactNode }) => (
  <div className="truncate rounded-md bg-surface-2 px-1.5 py-1 font-mono text-[9.5px] text-muted-foreground">
    {children}
  </div>
);

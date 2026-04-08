import { KIND_LABEL, type InputPort } from "../types";

export type { InputPort };

export type InputPortRowProps = {
  port: InputPort;
};

export const InputPortRow = ({ port }: InputPortRowProps) => (
  <div className="flex items-start gap-3 border-b border-border/50 py-2.5 last:border-0">
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs font-semibold text-foreground">{port.name}</span>
        <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {KIND_LABEL[port.kind]}
        </span>
        {port.required && (
          <span className="rounded border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
            必填
          </span>
        )}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{port.description}</p>
    </div>
  </div>
);

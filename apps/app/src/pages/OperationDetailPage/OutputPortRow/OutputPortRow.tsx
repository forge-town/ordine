import { KIND_LABEL } from "../types";
import type { OutputPort } from "@repo/schemas";

export type OutputPortRowProps = {
  port: OutputPort;
};

export const OutputPortRow = ({ port }: OutputPortRowProps) => (
  <div className="flex items-start gap-3 border-b border-border/50 py-2.5 last:border-0">
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs font-semibold text-foreground">{port.name}</span>
        <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {KIND_LABEL[port.kind]}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{port.description}</p>
      <p className="font-mono text-[11px] text-muted-foreground/60">{port.path}</p>
    </div>
  </div>
);

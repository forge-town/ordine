import { type FC } from "react";
import type { OutputItem } from "@repo/schemas";

interface OutputItemRowProps {
  item: OutputItem;
}

export const OutputItemRow: FC<OutputItemRowProps> = ({ item }) => (
  <div className="flex items-start gap-3 border-b border-border/50 py-2.5 last:border-0">
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs font-semibold text-foreground">{item.name}</span>
        <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {item.contentType}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{item.description}</p>
    </div>
  </div>
);

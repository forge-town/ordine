import { CollapsibleNode } from "./CollapsibleNode";
import { formatValue } from "./inputSnapshotHelpers";

interface TreeViewProps {
  data: unknown;
}

export const TreeView = ({ data }: TreeViewProps) => {
  if (data === null || data === undefined) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  if (typeof data !== "object") {
    return <span className="text-xs font-mono text-foreground break-all">{String(data)}</span>;
  }

  if (Array.isArray(data)) {
    return (
      <div className="space-y-0.5">
        {data.map((item, i) => (
          <CollapsibleNode key={i} label={`[${i}]`} value={item} />
        ))}
      </div>
    );
  }

  const entries = Object.entries(data as Record<string, unknown>);
  if (entries.length === 0) {
    return <span className="text-xs text-muted-foreground">{"{ }"}</span>;
  }

  return (
    <div className="space-y-0.5">
      {entries.map(([key, value]) => {
        if (typeof value === "object" && value !== null) {
          return <CollapsibleNode key={key} label={key} value={value} />;
        }

        return (
          <div
            key={key}
            className="flex items-start gap-3 py-1.5 border-b border-border/50 last:border-0"
          >
            <span className="w-28 shrink-0 text-xs text-muted-foreground">{key}</span>
            <span className="flex-1 text-xs font-mono text-foreground break-all">
              {formatValue(value)}
            </span>
          </div>
        );
      })}
    </div>
  );
};

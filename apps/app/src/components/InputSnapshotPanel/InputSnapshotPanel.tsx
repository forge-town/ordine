import { useState } from "react";
import { ChevronRight, List, Code2 } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/button";

type ViewMode = "structured" | "tree";

interface InputSnapshotPanelProps {
  data: unknown;
}

/* ── Helpers ──────────────────────────────────────────────────────── */

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value || "—";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    if (value.every((v) => typeof v === "string" || typeof v === "number"))
      return value.join(", ");

    return JSON.stringify(value, null, 2);
  }
  if (typeof value === "object") return JSON.stringify(value, null, 2);

  return String(value);
};

const isComplexValue = (value: unknown): boolean => {
  if (Array.isArray(value) && value.some((v) => typeof v === "object" && v !== null)) return true;
  if (typeof value === "object" && value !== null && !Array.isArray(value)) return true;

  return false;
};

/* ── Structured View (MetaRow style) ─────────────────────────────── */

const SnapshotRow = ({ label, value }: { label: string; value: unknown }) => {
  if (value === null || value === undefined) return null;

  const complex = isComplexValue(value);
  const formatted = formatValue(value);

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
      <span className="w-32 shrink-0 text-xs text-muted-foreground">{label}</span>
      {complex ? (
        <pre className="flex-1 text-xs font-mono text-foreground whitespace-pre-wrap break-all">
          {formatted}
        </pre>
      ) : (
        <span className={cn("flex-1 text-xs text-foreground break-all font-mono")}>
          {formatted}
        </span>
      )}
    </div>
  );
};

const StructuredView = ({ data }: { data: Record<string, unknown> }) => (
  <div>
    {Object.entries(data).map(([key, value]) => (
      <SnapshotRow key={key} label={key} value={value} />
    ))}
  </div>
);

/* ── Collapsible Tree View ───────────────────────────────────────── */

const CollapsibleNode = ({ label, value }: { label: string; value: unknown }) => {
  const [open, setOpen] = useState(false);
  const isArray = Array.isArray(value);
  const count = isArray
    ? value.length
    : typeof value === "object" && value !== null
      ? Object.keys(value).length
      : 0;

  return (
    <div className="border-b border-border/50 last:border-0">
      <button
        className="flex w-full items-center gap-2 py-2 text-left hover:bg-accent/30 rounded-sm transition-colors -mx-1 px-1"
        onClick={() => setOpen(!open)}
      >
        <ChevronRight
          className={cn(
            "h-3 w-3 text-muted-foreground transition-transform",
            open && "rotate-90",
          )}
        />
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-[10px] text-muted-foreground/60">
          {isArray ? `[${count}]` : `{${count}}`}
        </span>
      </button>
      {open && (
        <div className="ml-5 border-l border-border/40 pl-3 pb-1">
          <TreeView data={value} />
        </div>
      )}
    </div>
  );
};

const TreeView = ({ data }: { data: unknown }) => {
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

/* ── Main Component ──────────────────────────────────────────────── */

export const InputSnapshotPanel = ({ data }: InputSnapshotPanelProps) => {
  const [viewMode, setViewMode] = useState<ViewMode>("structured");

  if (data === null || data === undefined) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  if (typeof data !== "object" || Array.isArray(data)) {
    return (
      <pre className="text-xs font-mono text-foreground whitespace-pre-wrap break-all">
        {formatValue(data)}
      </pre>
    );
  }

  const entries = Object.entries(data as Record<string, unknown>);
  if (entries.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <div>
      <div className="flex items-center gap-1 mb-3">
        <Button
          className={cn("h-6 px-2 text-[11px]", viewMode === "structured" && "bg-accent")}
          size="sm"
          variant="ghost"
          onClick={() => setViewMode("structured")}
        >
          <List className="mr-1 h-3 w-3" />
          Structured
        </Button>
        <Button
          className={cn("h-6 px-2 text-[11px]", viewMode === "tree" && "bg-accent")}
          size="sm"
          variant="ghost"
          onClick={() => setViewMode("tree")}
        >
          <Code2 className="mr-1 h-3 w-3" />
          Tree
        </Button>
      </div>
      {viewMode === "structured" ? (
        <StructuredView data={data as Record<string, unknown>} />
      ) : (
        <TreeView data={data} />
      )}
    </div>
  );
};

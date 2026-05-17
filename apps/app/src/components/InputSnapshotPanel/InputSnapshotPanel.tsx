import { useState } from "react";
import { List, Code2 } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/button";
import { StructuredView } from "./StructuredView";
import { TreeView } from "./TreeView";
import { formatValue } from "./inputSnapshotHelpers";

type ViewMode = "structured" | "tree";

interface InputSnapshotPanelProps {
  data: unknown;
}

export const InputSnapshotPanel = ({ data }: InputSnapshotPanelProps) => {
  const [viewMode, setViewMode] = useState<ViewMode>("structured");
  const handleStructuredViewButtonClick = () => setViewMode("structured");
  const handleTreeViewButtonClick = () => setViewMode("tree");

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
          onClick={handleStructuredViewButtonClick}
        >
          <List className="mr-1 h-3 w-3" />
          Structured
        </Button>
        <Button
          className={cn("h-6 px-2 text-[11px]", viewMode === "tree" && "bg-accent")}
          size="sm"
          variant="ghost"
          onClick={handleTreeViewButtonClick}
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

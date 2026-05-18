import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "@repo/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { TreeView } from "./TreeView";

interface CollapsibleNodeProps {
  label: string;
  value: unknown;
}

export const CollapsibleNode = ({ label, value }: CollapsibleNodeProps) => {
  const [open, setOpen] = useState(false);
  const isArray = Array.isArray(value);
  const count = isArray
    ? value.length
    : typeof value === "object" && value !== null
      ? Object.keys(value).length
      : 0;
  const handleNodeToggleButtonClick = () => setOpen(!open);

  return (
    <div className="border-b border-border/50 last:border-0">
      <Button
        className="-mx-1 flex h-auto w-full items-center justify-start gap-2 rounded-sm px-1 py-2 text-left hover:bg-accent/30"
        variant="ghost"
        onClick={handleNodeToggleButtonClick}
      >
        <ChevronRight
          className={cn("h-3 w-3 text-muted-foreground transition-transform", open && "rotate-90")}
        />
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-[10px] text-muted-foreground/60">
          {isArray ? `[${count}]` : `{${count}}`}
        </span>
      </Button>
      {open && (
        <div className="ml-5 border-l border-border/40 pl-3 pb-1">
          <TreeView data={value} />
        </div>
      )}
    </div>
  );
};

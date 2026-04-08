import { ChevronRight, Layers } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import type { PipelineEntity } from "@/models/daos/pipelinesDao";

export type PipelineRowProps = {
  pipeline: PipelineEntity;
  selected: boolean;
  onSelect: () => void;
};

export const PipelineRow = ({
  pipeline,
  selected,
  onSelect,
}: PipelineRowProps) => {
  return (
    <button
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
        selected
          ? "border-primary/50 bg-primary/5"
          : "border-border bg-card hover:border-primary/50 hover:bg-accent",
      )}
      onClick={onSelect}
    >
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded",
          selected ? "bg-primary" : "bg-primary/10",
        )}
      >
        <Layers
          className={cn(
            "h-3.5 w-3.5",
            selected ? "text-primary-foreground" : "text-primary",
          )}
        />
      </span>
      <div className="flex-1 min-w-0">
        <p className="truncate text-xs font-medium text-foreground">
          {pipeline.name}
        </p>
        {pipeline.description && (
          <p className="truncate text-[10px] text-muted-foreground">
            {pipeline.description}
          </p>
        )}
      </div>
      <ChevronRight
        className={cn(
          "h-3.5 w-3.5 shrink-0 transition-colors",
          selected ? "text-primary" : "text-muted-foreground",
        )}
      />
    </button>
  );
};

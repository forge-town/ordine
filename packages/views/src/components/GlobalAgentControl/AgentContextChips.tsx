import { X } from "lucide-react";
import { Button } from "@repo/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { useAgentControl } from "./GlobalAgentControlProvider";

type Chip = { key: string; label: string };

export const AgentContextChips = ({ className }: { className?: string }) => {
  const context = useAgentControl((state) => state.context);
  const removed = useAgentControl((state) => state.removedContextChips);
  const remove = useAgentControl((state) => state.removeContextChip);
  const restore = useAgentControl((state) => state.restoreContextChips);
  const chips: Chip[] = [
    { key: "route", label: context.route.label ?? context.route.pathname },
    ...(context.projectId ? [{ key: "project", label: `Project ${context.projectId}` }] : []),
    ...(context.pipelineId ? [{ key: "pipeline", label: `Pipeline ${context.pipelineId}` }] : []),
    ...context.selectedResources.map((resource) => ({
      key: `resource:${resource.type}:${resource.id}`,
      label: resource.label ?? `${resource.type} ${resource.id}`,
    })),
    ...(context.selectedNodeIds.length > 0
      ? [{ key: "nodes", label: `${context.selectedNodeIds.length} selected node(s)` }]
      : []),
  ].filter((chip) => !removed.includes(chip.key));

  if (chips.length === 0 && removed.length === 0) return null;

  return (
    <div className={cn("flex min-w-0 flex-wrap items-center gap-1.5", className)}>
      {chips.map((chip) => (
        <span
          className="inline-flex max-w-56 items-center gap-1 rounded-full border border-border bg-muted/55 px-2 py-1 text-[11px] text-muted-foreground"
          key={chip.key}
        >
          <span className="truncate">{chip.label}</span>
          <button
            aria-label={`Remove ${chip.label} from this message`}
            className="rounded-full p-0.5 transition-colors hover:bg-background hover:text-foreground"
            type="button"
            onClick={() => remove(chip.key)}
          >
            <X className="size-2.5" />
          </button>
        </span>
      ))}
      {removed.length > 0 && (
        <Button className="h-6 px-2 text-[11px]" size="xs" variant="ghost" onClick={restore}>
          Restore context
        </Button>
      )}
    </div>
  );
};

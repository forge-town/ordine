import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { useAgentControl } from "./GlobalAgentControlProvider";

type Chip = { key: string; label: string };

export const AgentContextChips = ({ className }: { className?: string }) => {
  const { t } = useTranslation();
  const context = useAgentControl((state) => state.context);
  const removed = useAgentControl((state) => state.removedContextChips);
  const remove = useAgentControl((state) => state.removeContextChip);
  const restore = useAgentControl((state) => state.restoreContextChips);
  const chips: Chip[] = [
    { key: "route", label: context.route.label ?? context.route.pathname },
    ...(context.projectId
      ? [{ key: "project", label: t("agentControl.context.project", { id: context.projectId }) }]
      : []),
    ...(context.pipelineId
      ? [{ key: "pipeline", label: t("agentControl.context.pipeline", { id: context.pipelineId }) }]
      : []),
    ...context.selectedResources.map((resource) => ({
      key: `resource:${resource.type}:${resource.id}`,
      label:
        resource.label ??
        t("agentControl.context.resource", { type: resource.type, id: resource.id }),
    })),
    ...(context.selectedNodeIds.length > 0
      ? [
          {
            key: "nodes",
            label: t("agentControl.context.nodes", { count: context.selectedNodeIds.length }),
          },
        ]
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
            aria-label={t("agentControl.context.remove", { label: chip.label })}
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
          {t("agentControl.context.restore")}
        </Button>
      )}
    </div>
  );
};

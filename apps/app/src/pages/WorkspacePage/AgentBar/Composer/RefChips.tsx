import { ArrowRightLeft, Box, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@repo/ui/lib/utils";
import type { WorkspaceCanvasRef } from "@repo/schemas";
import { Icon } from "@/components/primitives";
import { useWorkspaceStore } from "../../_store/workspaceStore";

export type RefChipsProps = {
  refs: WorkspaceCanvasRef[];
  small?: boolean;
  onRemoveRef?: (id: string) => void;
};

export const RefChips = ({ onRemoveRef, refs, small = false }: RefChipsProps) => {
  const { t } = useTranslation();
  const setHoverRef = useWorkspaceStore((state) => state.setHoverRef);
  const focusRef = useWorkspaceStore((state) => state.focusRef);

  if (refs.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-1", !small && "pb-1.5")}>
      {refs.map((ref) => (
        <span
          className={cn(
            "group inline-flex max-w-45 cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-transparent transition-all hover:ring-border-strong",
            small ? "bg-foreground/10" : "bg-accent",
          )}
          data-testid={`ref-chip-${ref.id}`}
          key={ref.id}
          title={t("workspace.agentBar.refChipTitle")}
          onClick={() => focusRef(ref)}
          onMouseEnter={() => setHoverRef(ref.id)}
          onMouseLeave={() => setHoverRef(null)}
        >
          <Icon
            className="shrink-0 text-foreground/60"
            icon={ref.type === "edge" ? ArrowRightLeft : Box}
            size={9}
          />
          <span className="truncate">{ref.label}</span>
          {onRemoveRef ? (
            <button
              aria-label={t("workspace.agentBar.removeRef", { label: ref.label })}
              className="ml-0.5 shrink-0 rounded-full p-0.5 hover:bg-foreground/10"
              data-testid={`ref-chip-remove-${ref.id}`}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onRemoveRef(ref.id);
              }}
            >
              <Icon icon={X} size={9} />
            </button>
          ) : null}
        </span>
      ))}
    </div>
  );
};

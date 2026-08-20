import { Group } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@repo/ui/lib/utils";
import { useStore } from "zustand";
import { useCanvasPageStore } from "../_store";
import { NodeCardPorts } from "../NodeCard/NodeCardPorts";
import type { CompoundNodeData } from "@repo/schemas";

export interface CompoundNodeProps {
  id: string;
  data: CompoundNodeData;
  selected?: boolean;
}

const handleMouseDown = (e: React.MouseEvent) => {
  e.stopPropagation();
};

export const CompoundNode = ({ id, data, selected }: CompoundNodeProps) => {
  const { t } = useTranslation();
  const store = useCanvasPageStore();
  const hoveredCompoundId = useStore(store, (s) => s.hoveredCompoundId);
  const updateNodeData = useStore(store, (s) => s.updateNodeData);

  const isHovered = hoveredCompoundId === id;

  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { label: e.target.value });
  };

  return (
    <div
      className={cn(
        "relative size-full min-h-30 min-w-50 rounded-xl bg-surface/80 shadow-soft ring-1 ring-border transition-all duration-150",
        selected
          ? "shadow-float ring-2 ring-foreground/40"
          : "hover:shadow-float hover:ring-border-strong",
        isHovered && "shadow-float ring-2 ring-foreground/30",
      )}
      data-testid="canvas-v2-node-shell-root"
    >
      <div className="flex items-center gap-2 border-b border-border/70 px-2.5 py-2">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-surface-2">
          <Group className="h-3.5 w-3.5 text-foreground/80" />
        </div>
        <div className="min-w-0 flex-1">
          <input
            aria-label={t("canvas.nodeLabel")}
            className="nodrag nopan w-full min-w-0 truncate border-0 bg-transparent p-0 text-[12px] font-semibold leading-tight text-foreground focus:outline-none"
            value={data.label}
            onChange={handleLabelChange}
            onMouseDown={handleMouseDown}
          />
          <div className="truncate text-[10px] text-muted-foreground">
            {t("canvas.compoundNode.childCount", { count: data.childNodeIds.length })}
          </div>
        </div>
      </div>

      <NodeCardPorts leftHandle leftHandleCount={1} rightHandle rightHandleCount={1} />
    </div>
  );
};

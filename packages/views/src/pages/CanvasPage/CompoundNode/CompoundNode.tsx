import { Handle, Position } from "@xyflow/react";
import { Group } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@repo/ui/lib/utils";
import { useStore } from "zustand";
import { useCanvasPageStore } from "../_store";
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
        "relative size-full min-h-30 min-w-50 rounded-xl border-2 border-dashed bg-indigo-50/30 transition-all duration-200",
        selected ? "border-indigo-500 shadow-lg" : "border-indigo-300/60",
        isHovered && "border-indigo-400 bg-indigo-50/50 shadow-md",
      )}
    >
      <Handle className="bg-indigo-400! w-3! h-3!" position={Position.Left} type="target" />

      <div className="flex items-center gap-1.5 px-3 py-2">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-indigo-100">
          <Group className="h-3.5 w-3.5 text-indigo-600" />
        </div>
        <input
          className="nodrag nopan bg-transparent text-xs font-semibold text-indigo-700 w-full focus:outline-none"
          value={data.label}
          onChange={handleLabelChange}
          onMouseDown={handleMouseDown}
        />
        {data.childNodeIds.length > 0 && (
          <span className="text-[10px] text-indigo-400 whitespace-nowrap">
            {t("canvas.compoundNode.childCount", { count: data.childNodeIds.length })}
          </span>
        )}
      </div>

      <Handle className="bg-indigo-400! w-3! h-3!" position={Position.Right} type="source" />
    </div>
  );
};

import { useState, useEffect, useRef } from "react";
import { Plus, LogIn, Wand2, ShieldCheck, LogOut } from "lucide-react";
import { useStore } from "zustand";
import { useHarnessCanvasStore } from "./_store";
import { allowedConnections, nodeTypeMeta } from "./nodeSchemas";
import type { NodeType } from "./nodeSchemas";
import { cn } from "@repo/ui/lib/utils";

const TYPE_ICONS: Record<NodeType, React.ElementType> = {
  input: LogIn,
  skill: Wand2,
  condition: ShieldCheck,
  output: LogOut,
};

interface Props {
  nodeId: string;
  nodeType: NodeType;
}

export const QuickAddButton = ({ nodeId, nodeType }: Props) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const store = useHarnessCanvasStore();

  const allowed = allowedConnections[nodeType];
  if (allowed.length === 0) return null;

  const handleAdd = (targetType: NodeType) => {
    store.getState().addNodeWithEdge(nodeId, targetType);
    setOpen(false);
  };

  // Close picker on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="absolute -right-9 top-1/2 -translate-y-1/2 z-50">
      {/* The "+" trigger button */}
      <button
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-gray-700 text-white shadow-md transition-all",
          "hover:bg-violet-600 hover:scale-110",
        )}
        title="添加连接节点"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>

      {/* Picker popover */}
      {open && (
        <div className="absolute left-7 top-1/2 -translate-y-1/2 z-[200] ml-1 min-w-[130px] rounded-xl border border-gray-200 bg-white py-1.5 shadow-xl">
          <p className="px-3 pb-1 text-[9px] font-semibold uppercase tracking-widest text-gray-400">
            选择类型
          </p>
          {allowed.map((type) => {
            const Icon = TYPE_ICONS[type];
            const meta = nodeTypeMeta[type];
            return (
              <button
                key={type}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  handleAdd(type);
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-gray-50",
                )}
              >
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded",
                    meta.iconBg,
                  )}
                >
                  <Icon className="h-2.5 w-2.5 text-white" />
                </span>
                {meta.shortLabel}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

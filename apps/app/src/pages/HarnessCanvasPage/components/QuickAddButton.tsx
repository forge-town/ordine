import { useState, useEffect, useRef } from "react";
import { Plus, LogIn, Wand2, ShieldCheck, LogOut } from "lucide-react";
import { useHarnessCanvasStore } from "../_store";
import {
  allowedConnections,
  nodeTypeMeta,
  type NodeType,
} from "../nodeSchemas";
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
    <div ref={ref} className="relative z-50">
      {/* The "+" trigger button */}
      <button
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-all",
          "hover:bg-slate-100 hover:text-slate-800 hover:scale-110",
        )}
        title="添加连接节点"
      >
        <Plus className="h-3 w-3" />
      </button>

      {/* Picker popover */}
      {open && (
        <div className="absolute left-6 top-1/2 -translate-y-1/2 z-[200] min-w-[130px] rounded-xl border border-slate-200 bg-white/95 backdrop-blur-md py-1.5 shadow-xl">
          <p className="px-3 pb-1 text-[9px] font-semibold uppercase tracking-widest text-slate-400">
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

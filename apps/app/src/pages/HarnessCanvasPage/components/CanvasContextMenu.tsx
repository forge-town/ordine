import { useEffect } from "react";
import { LogIn, Wand2, ShieldCheck, LogOut } from "lucide-react";
import { useHarnessCanvasStore } from "../_store";
import { makeDefaultNodeData, nodeTypeMeta, type NodeType } from "../nodeSchemas";
import { cn } from "@repo/ui/lib/utils";

const TYPE_ICONS: Record<NodeType, React.ElementType> = {
  input: LogIn,
  skill: Wand2,
  condition: ShieldCheck,
  output: LogOut,
};

const ALL_TYPES: NodeType[] = ["input", "skill", "condition", "output"];

interface Props {
  screenX: number;
  screenY: number;
  flowX: number;
  flowY: number;
  onClose: () => void;
}

export const CanvasContextMenu = ({
  screenX,
  screenY,
  flowX,
  flowY,
  onClose,
}: Props) => {
  const store = useHarnessCanvasStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleCreate = (type: NodeType) => {
    const newId = `${type}-${Date.now()}`;
    store.getState().addNode({
      id: newId,
      type,
      position: { x: flowX, y: flowY },
      data: makeDefaultNodeData(type),
    });
    onClose();
  };

  // Clamp to viewport edges
  const left = Math.min(screenX, window.innerWidth - 180);
  const top = Math.min(screenY, window.innerHeight - 200);

  return (
    <>
      {/* Invisible backdrop – closes menu on outside click */}
      <div className="fixed inset-0 z-[999]" onClick={onClose} />

      {/* Menu */}
      <div
        className="fixed z-[1000] min-w-[170px] overflow-hidden rounded-xl border bg-popover py-1 shadow-2xl"
        style={{ left, top }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="px-3 py-1.5 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
          新建节点
        </p>
        {ALL_TYPES.map((type) => {
          const Icon = TYPE_ICONS[type];
          const meta = nodeTypeMeta[type];
          return (
            <button
              key={type}
              onClick={() => handleCreate(type)}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors text-foreground"
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded",
                  meta.iconBg,
                )}
              >
                <Icon className="h-3 w-3 text-white" />
              </span>
              <span className="text-xs font-medium">{meta.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
};

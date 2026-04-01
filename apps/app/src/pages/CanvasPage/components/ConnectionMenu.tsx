import { useEffect } from "react";
import { useStore } from "zustand";
import {
  Wand2,
  ShieldCheck,
  LogOut,
  Plus,
  FileCode,
  Folder,
} from "lucide-react";
import { SiGitHubIcon } from "../nodes/GitHubProjectNode/SiGitHubIcon";
import { useHarnessCanvasStore } from "../_store";
import {
  makeDefaultNodeData,
  nodeTypeMeta,
  allowedConnections,
  type NodeType,
} from "../nodeSchemas";
import { cn } from "@repo/ui/lib/utils";

const TYPE_ICONS: Record<NodeType, React.ElementType> = {
  skill: Wand2,
  condition: ShieldCheck,
  output: LogOut,
  "code-file": FileCode,
  folder: Folder,
  "github-project": SiGitHubIcon,
};

interface Props {
  screenX: number;
  screenY: number;
  flowX: number;
  flowY: number;
  onClose: () => void;
}

export const ConnectionMenu = ({
  screenX,
  screenY,
  flowX,
  flowY,
  onClose,
}: Props) => {
  const store = useHarnessCanvasStore();
  const connectStart = useStore(store, (s) => s.connectStart);
  const nodes = useStore(store, (s) => s.nodes);
  const setConnectStart = useStore(store, (s) => s.setConnectStart);
  const onConnect = useStore(store, (s) => s.onConnect);
  const addNode = useStore(store, (s) => s.addNode);

  const sourceNode = connectStart
    ? nodes.find((n) => n.id === connectStart.nodeId)
    : null;

  const availableTypes: NodeType[] = sourceNode
    ? allowedConnections[sourceNode.type]
    : [];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setConnectStart(null);
        onClose();
      }
    };
    globalThis.addEventListener("keydown", handler);
    return () => globalThis.removeEventListener("keydown", handler);
  }, [onClose, setConnectStart]);

  const handleSelect = (type: NodeType) => {
    const newId = `${type}-${Date.now()}`;

    addNode({
      id: newId,
      type,
      position: { x: flowX + 40, y: flowY - 40 },
      data: makeDefaultNodeData(type),
    });

    if (connectStart) {
      if (connectStart.handleType === "source") {
        onConnect({
          source: connectStart.nodeId,
          sourceHandle: connectStart.handleId,
          target: newId,
          targetHandle: null,
        });
      } else {
        onConnect({
          source: newId,
          sourceHandle: null,
          target: connectStart.nodeId,
          targetHandle: connectStart.handleId,
        });
      }
    }

    setConnectStart(null);
    onClose();
  };

  if (!sourceNode || availableTypes.length === 0) return null;

  const sourceMeta = nodeTypeMeta[sourceNode.type];
  const SourceIcon = TYPE_ICONS[sourceNode.type];

  // Clamp to viewport edges
  const left = Math.min(screenX, window.innerWidth - 200);
  const top = Math.min(
    screenY,
    window.innerHeight - (48 + availableTypes.length * 44),
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-999"
        onClick={() => {
          setConnectStart(null);
          onClose();
        }}
      />

      {/* Menu */}
      <div
        className="fixed z-1000 w-48 overflow-hidden rounded-xl border border-border/60 bg-popover shadow-2xl"
        style={{ left, top }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2.5">
          <span
            className={cn(
              "flex h-5 w-5 shrink-0 items-center justify-center rounded",
              sourceMeta.iconBg,
            )}
          >
            <SourceIcon className="h-3 w-3 text-white" />
          </span>
          <span className="text-[11px] font-semibold text-foreground">
            {sourceMeta.label}
          </span>
          <span className="ml-auto text-[10px] text-muted-foreground">
            连接到
          </span>
        </div>

        {/* Options grouped by category */}
        <div className="py-1">
          {[
            {
              label: "处理对象",
              types: ["code-file", "folder", "github-project"] as NodeType[],
            },
            {
              label: "操作节点",
              types: ["skill", "condition", "output"] as NodeType[],
            },
          ].map((group, gi) => {
            const visible = group.types.filter((t) =>
              availableTypes.includes(t),
            );
            if (visible.length === 0) return null;
            return (
              <div key={group.label}>
                {gi > 0 && <div className="my-1 border-t border-border/50" />}
                <p className="px-3 pt-1 pb-0.5 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                  {group.label}
                </p>
                {visible.map((type) => {
                  const Icon = TYPE_ICONS[type];
                  const meta = nodeTypeMeta[type];
                  return (
                    <button
                      key={type}
                      onClick={() => handleSelect(type)}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      <span
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded",
                          meta.iconBg,
                        )}
                      >
                        <Icon className="h-3.5 w-3.5 text-white" />
                      </span>
                      <span className="text-xs font-medium text-foreground">
                        {meta.label}
                      </span>
                      <Plus className="ml-auto h-3 w-3 text-muted-foreground" />
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

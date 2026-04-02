import { useState, useEffect } from "react";
import { useStore } from "zustand";
import {
  ChevronRight,
  Play,
  Copy,
  Trash2,
  Zap,
  ShieldCheck,
  FileCode,
  Folder,
} from "lucide-react";
import { SiGitHubIcon } from "../nodes/GitHubProjectNode/SiGitHubIcon";
import { useHarnessCanvasStore } from "../_store";
import {
  nodeTypeMeta,
  allowedConnections,
  makeDefaultNodeData,
  type NodeType,
} from "../nodeSchemas";
import { cn } from "@repo/ui/lib/utils";

const TYPE_ICONS: Record<NodeType, React.ElementType> = {
  condition: ShieldCheck,
  "code-file": FileCode,
  folder: Folder,
  "github-project": SiGitHubIcon,
};

const TYPE_GROUPS: { label: string; types: NodeType[] }[] = [
  { label: "操作节点", types: ["condition"] },
  { label: "处理对象", types: ["code-file", "folder", "github-project"] },
];

const KbdHint = ({ keys }: { keys: string }) => (
  <span className="ml-auto font-mono text-[11px] text-muted-foreground/50">
    {keys}
  </span>
);

interface Props {
  screenX: number;
  screenY: number;
  nodeId: string;
  onClose: () => void;
}

export const NodeContextMenu = ({
  screenX,
  screenY,
  nodeId,
  onClose,
}: Props) => {
  const store = useHarnessCanvasStore();
  const nodes = useStore(store, (state) => state.nodes);
  const node = nodes.find((n) => n.id === nodeId);
  const [actionsOpen, setActionsOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "d" && e.metaKey) {
        e.preventDefault();
        store.getState().duplicateNode(nodeId);
        onClose();
      }
    };
    globalThis.addEventListener("keydown", handler);
    return () => globalThis.removeEventListener("keydown", handler);
  }, [onClose, store, nodeId]);

  if (!node) return null;

  const meta = nodeTypeMeta[node.type];
  const availableTypes = allowedConnections[node.type];

  const MENU_W = 224;
  const SUBMENU_W = 208;
  const left = Math.min(screenX, window.innerWidth - MENU_W - 8);
  const top = Math.min(screenY, window.innerHeight - 280);
  const submenuLeft =
    left + MENU_W + 4 + SUBMENU_W > window.innerWidth
      ? left - SUBMENU_W - 4
      : left + MENU_W + 4;

  const handleDuplicate = () => {
    store.getState().duplicateNode(nodeId);
    onClose();
  };

  const handleDelete = () => {
    store.getState().removeNode(nodeId);
    onClose();
  };

  const handleAddConnected = (type: NodeType) => {
    const state = store.getState();
    const newId = `${type}-${Date.now()}`;
    state.addNode({
      id: newId,
      type,
      position: { x: node.position.x + 280, y: node.position.y },
      data: makeDefaultNodeData(type),
    });
    state.onConnect({
      source: nodeId,
      sourceHandle: null,
      target: newId,
      targetHandle: null,
    });
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[999]" onClick={onClose} />

      {/* Main menu */}
      <div
        className="fixed z-[1001] w-56 overflow-hidden rounded-xl border border-border/60 bg-popover py-1 shadow-2xl"
        style={{ left, top }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Node type header */}
        <div className="flex items-center gap-2 border-b border-border/40 px-3 py-2 mb-0.5">
          <span
            className={`flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold text-white ${meta.iconBg}`}
          >
            {meta.shortLabel.charAt(0)}
          </span>
          <span className="text-xs font-semibold text-foreground">
            {meta.label}
          </span>
        </div>

        {/* Actions → */}
        <button
          className={cn(
            "flex w-full items-center gap-2.5 px-3 py-2 text-sm text-foreground",
            actionsOpen ? "bg-accent" : "hover:bg-accent",
          )}
          onClick={() => setActionsOpen((v) => !v)}
        >
          <Zap className="h-3.5 w-3.5 text-muted-foreground" />
          Actions
          <ChevronRight
            className={cn(
              "ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform",
              actionsOpen && "rotate-90",
            )}
          />
        </button>

        {/* Run Node */}
        <button
          className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-accent"
          onClick={onClose}
        >
          <Play className="h-3.5 w-3.5 text-muted-foreground" />
          Run Node
          <KbdHint keys="⇧R" />
        </button>

        {/* Duplicate */}
        <button
          className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-accent"
          onClick={handleDuplicate}
        >
          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
          Duplicate
          <KbdHint keys="⌘D" />
        </button>

        <div className="mx-3 my-1 border-t border-border/40" />

        {/* Delete */}
        <button
          className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
          onClick={handleDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
          <span className="ml-auto font-mono text-[11px] text-destructive/40">
            ⌫
          </span>
        </button>
      </div>

      {/* Actions submenu */}
      {actionsOpen && (
        <div
          className="fixed z-[1001] w-52 overflow-hidden rounded-xl border border-border/60 bg-popover py-1 shadow-2xl"
          style={{ left: submenuLeft, top }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="px-3 py-1.5 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
            连接新节点
          </p>
          {TYPE_GROUPS.map((group) => {
            const visible = group.types.filter((t) =>
              availableTypes.includes(t),
            );
            if (visible.length === 0) return null;
            return (
              <div key={group.label}>
                <p className="px-3 pt-1 pb-0.5 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                  {group.label}
                </p>
                {visible.map((type) => {
                  const Icon = TYPE_ICONS[type];
                  const m = nodeTypeMeta[type];
                  return (
                    <button
                      key={type}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-accent"
                      onClick={() => handleAddConnected(type)}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded ${m.iconBg}`}
                      >
                        <Icon className="h-2.5 w-2.5 text-white" />
                      </span>
                      {m.shortLabel}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};

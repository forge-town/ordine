import { useEffect } from "react";
import {
  LogIn,
  Wand2,
  ShieldCheck,
  LogOut,
  ArrowRight,
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
  input: LogIn,
  skill: Wand2,
  condition: ShieldCheck,
  output: LogOut,
  "code-file": FileCode,
  folder: Folder,
  "github-project": SiGitHubIcon,
};

const ALL_TYPES: NodeType[] = [
  "input",
  "skill",
  "condition",
  "output",
  "code-file",
  "folder",
  "github-project",
];

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
  const state = store.getState();
  const connectStart = state.connectStart;
  const nodes = state.nodes;

  // 确定可用的节点类型
  const availableTypes = (() => {
    if (!connectStart) return ALL_TYPES;

    const sourceNode = nodes.find((n) => n.id === connectStart.nodeId);
    if (!sourceNode) return ALL_TYPES;

    // 返回源节点可以连接到的目标类型
    return allowedConnections[sourceNode.type];
  })();

  // 判断是否为连接模式
  const isConnectMode = connectStart !== null;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        state.setConnectStart(null);
        onClose();
      }
    };
    globalThis.addEventListener("keydown", handler);
    return () => globalThis.removeEventListener("keydown", handler);
  }, [onClose, state]);

  const handleCreate = (type: NodeType) => {
    const newId = `${type}-${Date.now()}`;

    // 创建新节点
    state.addNode({
      id: newId,
      type,
      position: { x: flowX, y: flowY },
      data: makeDefaultNodeData(type),
    });

    // 如果是连接模式，自动创建连接
    if (connectStart) {
      const sourceNode = nodes.find((n) => n.id === connectStart.nodeId);
      if (sourceNode) {
        // 确定连接方向
        if (connectStart.handleType === "source") {
          // 从源节点连接到新节点
          state.onConnect({
            source: connectStart.nodeId,
            sourceHandle: connectStart.handleId,
            target: newId,
            targetHandle: null,
          });
        } else {
          // 从新节点连接到目标节点（反向连接）
          state.onConnect({
            source: newId,
            sourceHandle: null,
            target: connectStart.nodeId,
            targetHandle: connectStart.handleId,
          });
        }
      }
    }

    // 清除连接状态并关闭菜单
    state.setConnectStart(null);
    onClose();
  };

  // Clamp to viewport edges
  const left = Math.min(screenX, window.innerWidth - 180);
  const top = Math.min(screenY, window.innerHeight - 200);

  // 获取源节点信息用于显示
  const sourceNodeInfo = (() => {
    if (!connectStart) return null;
    const node = nodes.find((n) => n.id === connectStart.nodeId);
    return node
      ? { type: node.type, label: nodeTypeMeta[node.type].label }
      : null;
  })();

  return (
    <>
      {/* Invisible backdrop – closes menu on outside click */}
      <div
        className="fixed inset-0 z-[999]"
        onClick={() => {
          state.setConnectStart(null);
          onClose();
        }}
      />

      {/* Menu */}
      <div
        className="fixed z-[1000] min-w-[170px] overflow-hidden rounded-xl border bg-popover py-1 shadow-2xl"
        style={{ left, top }}
        onClick={(e) => e.stopPropagation()}
      >
        {isConnectMode && sourceNodeInfo ? (
          <>
            <div className="flex items-center gap-2 px-3 py-1.5">
              <span
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded",
                  nodeTypeMeta[sourceNodeInfo.type].iconBg,
                )}
              >
                {(() => {
                  const Icon = TYPE_ICONS[sourceNodeInfo.type];
                  return <Icon className="h-2.5 w-2.5 text-white" />;
                })()}
              </span>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] font-medium text-muted-foreground">
                连接到...
              </span>
            </div>
          </>
        ) : (
          <p className="px-3 py-1.5 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
            新建节点
          </p>
        )}
        {availableTypes.map((type) => {
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

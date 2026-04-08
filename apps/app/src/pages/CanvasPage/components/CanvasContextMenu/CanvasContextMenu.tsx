import { useEffect } from "react";
import { ArrowRight, FileCode, Folder, HardDrive, FolderOutput, Zap } from "lucide-react";
import { SiGitHubIcon } from "../../nodes/GitHubProjectNode/SiGitHubIcon";
import { useHarnessCanvasStore } from "../../_store";
import {
  makeDefaultNodeData,
  makeOperationNodeData,
  nodeTypeMeta,
  getAllowedConnections,
  type NodeType,
} from "../../nodeSchemas";
import { cn } from "@repo/ui/lib/utils";

const TYPE_ICONS: Record<NodeType | "operation", React.ElementType> = {
  operation: Zap,
  "code-file": FileCode,
  folder: Folder,
  "github-project": SiGitHubIcon,
  "output-project-path": FolderOutput,
  "output-local-path": HardDrive,
};

const OBJECT_TYPES: NodeType[] = ["code-file", "folder", "github-project"];

interface Props {
  screenX: number;
  screenY: number;
  flowX: number;
  flowY: number;
  onClose: () => void;
}

const handleStopPropagation = (e: React.MouseEvent) => e.stopPropagation();

export const CanvasContextMenu = ({ screenX, screenY, flowX, flowY, onClose }: Props) => {
  const store = useHarnessCanvasStore();
  const state = store.getState();
  const connectStart = state.connectStart;
  const nodes = state.nodes;
  const operations = state.operations;

  // Get allowed connections based on current operations
  const allowedConnections = getAllowedConnections(operations);

  // Determine available node types
  const availableTypes = (() => {
    if (!connectStart) return [...OBJECT_TYPES, "operation"] as NodeType[];

    const sourceNode = nodes.find((n) => n.id === connectStart.nodeId);
    if (!sourceNode) return [...OBJECT_TYPES, "operation"] as NodeType[];

    // Return allowed target types for the source node
    return allowedConnections[sourceNode.type] ?? [];
  })();

  // Filter operations based on source type (if in connect mode)
  const availableOperations = (() => {
    if (!connectStart) return operations;

    const sourceNode = nodes.find((n) => n.id === connectStart.nodeId);
    if (!sourceNode) return operations;

    // Map node type to object type
    const objectTypeMap: Record<string, string> = {
      "code-file": "file",
      folder: "folder",
      "github-project": "project",
    };
    const objectType = objectTypeMap[sourceNode.type];
    if (!objectType) return operations;

    // Only show operations that accept this object type
    return operations.filter((op) =>
      op.acceptedObjectTypes?.includes(objectType as "file" | "folder" | "project")
    );
  })();

  // Check if operation type is available
  const canAddOperation = availableTypes.includes("operation");

  // Determine if in connection mode
  const isConnectMode = connectStart !== null;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        state.handleConnectStart(null);
        onClose();
      }
    };
    globalThis.addEventListener("keydown", handler);
    return () => globalThis.removeEventListener("keydown", handler);
  }, [onClose, state]);

  const handleCreateObject = (type: NodeType) => {
    const newId = `${type}-${Date.now()}`;

    // Create new node
    state.addNode({
      id: newId,
      type,
      position: { x: flowX, y: flowY },
      data: makeDefaultNodeData(type),
    });

    // If in connection mode, auto-create connection
    if (connectStart) {
      const sourceNode = nodes.find((n) => n.id === connectStart.nodeId);
      if (sourceNode) {
        if (connectStart.handleType === "source") {
          state.onConnect({
            source: connectStart.nodeId,
            sourceHandle: connectStart.handleId,
            target: newId,
            targetHandle: null,
          });
        } else {
          state.onConnect({
            source: newId,
            sourceHandle: null,
            target: connectStart.nodeId,
            targetHandle: connectStart.handleId,
          });
        }
      }
    }

    state.handleConnectStart(null);
    onClose();
  };

  const handleCreateOperation = (operationId: string) => {
    const operation = operations.find((op) => op.id === operationId);
    if (!operation) return;

    const newId = `op-${operationId}-${Date.now()}`;

    // Create new operation node
    state.addNode({
      id: newId,
      type: "operation",
      position: { x: flowX, y: flowY },
      data: makeOperationNodeData(operation),
    });

    // If in connection mode, auto-create connection
    if (connectStart) {
      const sourceNode = nodes.find((n) => n.id === connectStart.nodeId);
      if (sourceNode) {
        if (connectStart.handleType === "source") {
          state.onConnect({
            source: connectStart.nodeId,
            sourceHandle: connectStart.handleId,
            target: newId,
            targetHandle: null,
          });
        } else {
          state.onConnect({
            source: newId,
            sourceHandle: null,
            target: connectStart.nodeId,
            targetHandle: connectStart.handleId,
          });
        }
      }
    }

    state.handleConnectStart(null);
    onClose();
  };

  // Clamp to viewport edges
  const left = Math.min(screenX, window.innerWidth - 220);
  const top = Math.min(screenY, window.innerHeight - 300);

  // Get source node info for display
  const sourceNodeInfo = (() => {
    if (!connectStart) return null;
    const node = nodes.find((n) => n.id === connectStart.nodeId);
    return node ? { type: node.type, label: nodeTypeMeta[node.type].label } : null;
  })();

  // Filter object types based on available connections
  const visibleObjectTypes = OBJECT_TYPES.filter((t) =>
    isConnectMode ? availableTypes.includes(t) : true
  );

  const handleBackdropClick = () => {
    state.handleConnectStart(null);
    onClose();
  };

  return (
    <>
      {/* Invisible backdrop – closes menu on outside click */}
      <div className="fixed inset-0 z-[999]" onClick={handleBackdropClick} />

      {/* Menu */}
      <div
        className="fixed z-[1000] max-h-[80vh] min-w-[200px] overflow-y-auto rounded-xl border bg-popover py-1 shadow-2xl"
        style={{ left, top }}
        onClick={handleStopPropagation}
      >
        {isConnectMode && sourceNodeInfo ? (
          <>
            <div className="flex items-center gap-2 px-3 py-1.5">
              <span
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded",
                  nodeTypeMeta[sourceNodeInfo.type].iconBg
                )}
              >
                {(() => {
                  const Icon = TYPE_ICONS[sourceNodeInfo.type];
                  return <Icon className="h-2.5 w-2.5 text-white" />;
                })()}
              </span>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] font-medium text-muted-foreground">连接到...</span>
            </div>
          </>
        ) : (
          <p className="px-3 py-1.5 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
            新建节点
          </p>
        )}

        {/* Object types group */}
        {visibleObjectTypes.length > 0 && (
          <div>
            <p className="px-3 pt-1 pb-0.5 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              处理对象 (Object)
            </p>
            {visibleObjectTypes.map((type) => {
              const Icon = TYPE_ICONS[type];
              const meta = nodeTypeMeta[type];
              return (
                <button
                  key={type}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors text-foreground"
                  onClick={() => handleCreateObject(type)}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded",
                      meta.iconBg
                    )}
                  >
                    <Icon className="h-3 w-3 text-white" />
                  </span>
                  <span className="text-xs font-medium">{meta.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Operations group */}
        {canAddOperation && availableOperations.length > 0 && (
          <div>
            <div className="my-1 border-t border-border/50" />
            <p className="px-3 pt-1 pb-0.5 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              操作节点 (Operation)
            </p>
            {availableOperations.map((operation) => (
              <button
                key={operation.id}
                className="flex w-full items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors text-foreground"
                onClick={() => handleCreateOperation(operation.id)}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-violet-500">
                  <Zap className="h-3 w-3 text-white" />
                </span>
                <span className="text-xs font-medium truncate">{operation.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Empty state for operations */}
        {canAddOperation && availableOperations.length === 0 && (
          <div>
            <div className="my-1 border-t border-border/50" />
            <p className="px-3 pt-1 pb-0.5 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              操作节点 (Operation)
            </p>
            <p className="px-3 py-2 text-[10px] text-muted-foreground">
              没有接受此类型的 Operation
            </p>
          </div>
        )}
      </div>
    </>
  );
};

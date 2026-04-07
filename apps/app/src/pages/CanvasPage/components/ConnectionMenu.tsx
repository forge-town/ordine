import { useEffect } from "react";
import { useStore } from "zustand";
import { Plus, Zap, FileCode, Folder, HardDrive, FolderOutput } from "lucide-react";
import { SiGitHubIcon } from "../nodes/GitHubProjectNode/SiGitHubIcon";
import { useHarnessCanvasStore } from "../_store";
import {
  makeDefaultNodeData,
  makeOperationNodeData,
  nodeTypeMeta,
  getAllowedConnections,
  type NodeType,
} from "../nodeSchemas";
import { cn } from "@repo/ui/lib/utils";

const TYPE_ICONS: Record<NodeType | "operation", React.ElementType> = {
  operation: Zap,
  "code-file": FileCode,
  folder: Folder,
  "github-project": SiGitHubIcon,
  "output-project-path": FolderOutput,
  "output-local-path": HardDrive,
};

interface Props {
  screenX: number;
  screenY: number;
  flowX: number;
  flowY: number;
  onClose: () => void;
}

const handleStopPropagation = (e: React.MouseEvent) => e.stopPropagation();

export const ConnectionMenu = ({ screenX, screenY, flowX, flowY, onClose }: Props) => {
  const store = useHarnessCanvasStore();
  const connectStart = useStore(store, (s) => s.connectStart);
  const nodes = useStore(store, (s) => s.nodes);
  const operations = useStore(store, (s) => s.operations);
  const setConnectStart = useStore(store, (s) => s.setConnectStart);
  const onConnect = useStore(store, (s) => s.onConnect);
  const addNode = useStore(store, (s) => s.addNode);

  const sourceNode = connectStart ? nodes.find((n) => n.id === connectStart.nodeId) : null;

  const allowedConnections = getAllowedConnections(operations);
  const availableTypes: NodeType[] = sourceNode ? (allowedConnections[sourceNode.type] ?? []) : [];

  // Filter operations based on source type
  const availableOperations = (() => {
    if (!sourceNode) return operations;
    const objectTypeMap: Record<string, string> = {
      "code-file": "file",
      folder: "folder",
      "github-project": "project",
    };
    const objectType = objectTypeMap[sourceNode.type];
    if (!objectType) return operations;
    return operations.filter((op) =>
      op.acceptedObjectTypes?.includes(objectType as "file" | "folder" | "project")
    );
  })();

  const canAddOperation = availableTypes.includes("operation");

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

  const handleSelectObject = (type: NodeType) => {
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

  const handleSelectOperation = (operationId: string) => {
    const operation = operations.find((op) => op.id === operationId);
    if (!operation) return;

    const newId = `op-${operationId}-${Date.now()}`;

    addNode({
      id: newId,
      type: "operation",
      position: { x: flowX + 40, y: flowY - 40 },
      data: makeOperationNodeData(operation),
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
  const left = Math.min(screenX, window.innerWidth - 220);
  const top = Math.min(screenY, window.innerHeight - 300);

  const handleBackdropClick = () => {
    setConnectStart(null);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-999" onClick={handleBackdropClick} />

      {/* Menu */}
      <div
        className="fixed z-1000 max-h-[80vh] w-52 overflow-y-auto rounded-xl border border-border/60 bg-popover shadow-2xl"
        style={{ left, top }}
        onClick={handleStopPropagation}
      >
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2.5">
          <span
            className={cn(
              "flex h-5 w-5 shrink-0 items-center justify-center rounded",
              sourceMeta.iconBg
            )}
          >
            <SourceIcon className="h-3 w-3 text-white" />
          </span>
          <span className="text-[11px] font-semibold text-foreground">{sourceMeta.label}</span>
          <span className="ml-auto text-[10px] text-muted-foreground">连接到</span>
        </div>

        {/* Options grouped by category */}
        <div className="py-1">
          {/* Object types */}
          {["code-file", "folder", "github-project"].some((t) =>
            availableTypes.includes(t as NodeType)
          ) && (
            <div>
              <p className="px-3 pt-1 pb-0.5 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                处理对象
              </p>
              {["code-file", "folder", "github-project"]
                .filter((t) => availableTypes.includes(t as NodeType))
                .map((type) => {
                  const Icon = TYPE_ICONS[type as NodeType];
                  const meta = nodeTypeMeta[type as NodeType];
                  return (
                    <button
                      key={type}
                      onClick={() => handleSelectObject(type as NodeType)}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      <span
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded",
                          meta.iconBg
                        )}
                      >
                        <Icon className="h-3.5 w-3.5 text-white" />
                      </span>
                      <span className="text-xs font-medium text-foreground">{meta.label}</span>
                      <Plus className="ml-auto h-3 w-3 text-muted-foreground" />
                    </button>
                  );
                })}
            </div>
          )}

          {/* Operations */}
          {canAddOperation && availableOperations.length > 0 && (
            <div>
              <div className="my-1 border-t border-border/50" />
              <p className="px-3 pt-1 pb-0.5 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                操作节点
              </p>
              {availableOperations.map((operation) => (
                <button
                  key={operation.id}
                  onClick={() => handleSelectOperation(operation.id)}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-violet-500">
                    <Zap className="h-3.5 w-3.5 text-white" />
                  </span>
                  <span className="text-xs font-medium text-foreground truncate">
                    {operation.name}
                  </span>
                  <Plus className="ml-auto h-3 w-3 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}

          {/* Empty state */}
          {canAddOperation && availableOperations.length === 0 && (
            <div>
              <div className="my-1 border-t border-border/50" />
              <p className="px-3 pt-1 pb-0.5 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                操作节点
              </p>
              <p className="px-3 py-2 text-[10px] text-muted-foreground">
                没有接受此类型的 Operation
              </p>
            </div>
          )}

          {/* Output node types */}
          {(["output-project-path", "output-local-path"] as NodeType[]).some((t) =>
            availableTypes.includes(t)
          ) && (
            <div>
              <div className="my-1 border-t border-border/50" />
              <p className="px-3 pt-1 pb-0.5 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                输出终点
              </p>
              {(["output-project-path", "output-local-path"] as NodeType[])
                .filter((t) => availableTypes.includes(t))
                .map((type) => {
                  const Icon = TYPE_ICONS[type];
                  const meta = nodeTypeMeta[type];
                  return (
                    <button
                      key={type}
                      onClick={() => handleSelectObject(type)}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      <span
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded",
                          meta.iconBg
                        )}
                      >
                        <Icon className="h-3.5 w-3.5 text-white" />
                      </span>
                      <span className="text-xs font-medium text-foreground">{meta.label}</span>
                      <Plus className="ml-auto h-3 w-3 text-muted-foreground" />
                    </button>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

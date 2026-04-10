import {
  ArrowRight,
  FileCode,
  Folder,
  HardDrive,
  FolderOutput,
  Zap,
  BookOpen,
} from "lucide-react";
import { useStore } from "zustand";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuLabel,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@repo/ui/context-menu";
import { SiGitHubIcon } from "../../nodes/GitHubProjectNode/SiGitHubIcon";
import { useHarnessCanvasStore } from "../../_store";
import { Route } from "@/routes/canvas";
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

export const CanvasContextMenu = ({
  screenX,
  screenY,
  flowX,
  flowY,
  onClose,
}: Props) => {
  const { operations, recipes } = Route.useLoaderData();
  const store = useHarnessCanvasStore();
  const connectStart = useStore(store, (s) => s.connectStart);
  const nodes = useStore(store, (s) => s.nodes);
  const addNode = useStore(store, (s) => s.addNode);
  const onConnect = useStore(store, (s) => s.onConnect);
  const handleConnectStart = useStore(store, (s) => s.handleConnectStart);

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
      op.acceptedObjectTypes?.includes(
        objectType as "file" | "folder" | "project",
      ),
    );
  })();

  // Check if operation type is available
  const canAddOperation = availableTypes.includes("operation");

  // Determine if in connection mode
  const isConnectMode = connectStart !== null;

  const handleCreateObject = (type: NodeType) => {
    const newId = `${type}-${Date.now()}`;

    // Create new node
    addNode({
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
    }

    handleConnectStart(null);
    onClose();
  };

  const handleCreateOperation = (operationId: string) => {
    const operation = operations.find((op) => op.id === operationId);
    if (!operation) return;

    const newId = `op-${operationId}-${Date.now()}`;

    // Create new operation node
    addNode({
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
    }

    handleConnectStart(null);
    onClose();
  };

  const handleCreateRecipe = (recipeId: string) => {
    const recipe = recipes.find((r) => r.id === recipeId);
    if (!recipe) return;
    const operation = operations.find((op) => op.id === recipe.operationId);
    if (!operation) return;

    const newId = `op-recipe-${Date.now()}`;
    addNode({
      id: newId,
      type: "operation",
      position: { x: flowX, y: flowY },
      data: {
        ...makeOperationNodeData(operation),
        label: recipe.name,
        bestPracticeId: recipe.bestPracticeId,
        bestPracticeName: recipe.name,
      },
    });

    if (connectStart) {
      const sourceNode = nodes.find((n) => n.id === connectStart.nodeId);
      if (sourceNode) {
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
    }

    handleConnectStart(null);
    onClose();
  };

  // Clamp to viewport edges
  const left = Math.min(screenX, window.innerWidth - 220);
  const top = Math.min(screenY, window.innerHeight - 300);

  // Get source node info for display
  const sourceNodeInfo = (() => {
    if (!connectStart) return null;
    const node = nodes.find((n) => n.id === connectStart.nodeId);
    return node
      ? { type: node.type, label: nodeTypeMeta[node.type].label }
      : null;
  })();

  // Filter object types based on available connections
  const visibleObjectTypes = OBJECT_TYPES.filter((t) =>
    isConnectMode ? availableTypes.includes(t) : true,
  );

  const virtualAnchor = {
    getBoundingClientRect: () => ({
      x: left,
      y: top,
      width: 0,
      height: 0,
      top,
      right: left,
      bottom: top,
      left,
      toJSON() {
        return this;
      },
    }),
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      handleConnectStart(null);
      onClose();
    }
  };

  return (
    <ContextMenu open onOpenChange={handleOpenChange}>
      <ContextMenuContent
        align="start"
        alignOffset={0}
        anchor={virtualAnchor}
        className="max-h-[80vh] min-w-50"
        positionMethod="fixed"
        side="bottom"
        sideOffset={0}
      >
        {isConnectMode && sourceNodeInfo ? (
          <div className="flex items-center gap-2 px-1.5 py-1.5">
            <span
              className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded",
                nodeTypeMeta[sourceNodeInfo.type].iconBg,
              )}
            >
              {(() => {
                const Icon = TYPE_ICONS[sourceNodeInfo.type];
                return <Icon className="size-2.5 text-white" />;
              })()}
            </span>
            <ArrowRight className="size-3 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">
              连接到...
            </span>
          </div>
        ) : (
          <div className="px-1.5 py-1 text-xs font-medium text-muted-foreground">
            新建节点
          </div>
        )}

        {/* Object types group */}
        {visibleObjectTypes.length > 0 && (
          <ContextMenuGroup>
            <ContextMenuLabel>处理对象 (Object)</ContextMenuLabel>
            {visibleObjectTypes.map((type) => {
              const Icon = TYPE_ICONS[type];
              const typeMeta = nodeTypeMeta[type];
              return (
                <ContextMenuItem
                  key={type}
                  closeOnClick={false}
                  onClick={() => handleCreateObject(type)}
                >
                  <span
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded",
                      typeMeta.iconBg,
                    )}
                  >
                    <Icon className="size-2.5 text-white" />
                  </span>
                  <span className="text-xs font-medium">{typeMeta.label}</span>
                </ContextMenuItem>
              );
            })}
          </ContextMenuGroup>
        )}

        {/* Operations group */}
        {canAddOperation && availableOperations.length > 0 && (
          <>
            <ContextMenuSeparator />
            <ContextMenuGroup>
              <ContextMenuLabel>操作节点 (Operation)</ContextMenuLabel>
              {availableOperations.map((operation) => (
                <ContextMenuItem
                  key={operation.id}
                  closeOnClick={false}
                  onClick={() => handleCreateOperation(operation.id)}
                >
                  <span className="flex size-4 shrink-0 items-center justify-center rounded bg-violet-500">
                    <Zap className="size-2.5 text-white" />
                  </span>
                  <span className="truncate text-xs font-medium">
                    {operation.name}
                  </span>
                </ContextMenuItem>
              ))}
            </ContextMenuGroup>
          </>
        )}

        {/* Empty state for operations */}
        {canAddOperation && availableOperations.length === 0 && (
          <>
            <ContextMenuSeparator />
            <ContextMenuGroup>
              <ContextMenuLabel>操作节点 (Operation)</ContextMenuLabel>
              <p className="px-1.5 py-1 text-xs text-muted-foreground">
                没有接受此类型的 Operation
              </p>
            </ContextMenuGroup>
          </>
        )}

        {/* Recipes group */}
        {canAddOperation && recipes.length > 0 && (
          <>
            <ContextMenuSeparator />
            <ContextMenuGroup>
              <ContextMenuLabel>快捷配方 (Recipe)</ContextMenuLabel>
              {recipes.map((recipe) => (
                <ContextMenuItem
                  key={recipe.id}
                  closeOnClick={false}
                  onClick={() => handleCreateRecipe(recipe.id)}
                >
                  <span className="flex size-4 shrink-0 items-center justify-center rounded bg-amber-500">
                    <BookOpen className="size-2.5 text-white" />
                  </span>
                  <span className="truncate text-xs font-medium">
                    {recipe.name}
                  </span>
                </ContextMenuItem>
              ))}
            </ContextMenuGroup>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
};

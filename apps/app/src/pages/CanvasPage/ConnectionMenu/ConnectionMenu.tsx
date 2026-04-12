import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import {
  Plus,
  Zap,
  FileCode,
  Folder,
  HardDrive,
  FolderOutput,
  BookOpen,
  Group,
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuLabel,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@repo/ui/context-menu";
import { SiGitHubIcon } from "../GitHubProjectNode/SiGitHubIcon";
import { useHarnessCanvasStore } from "../_store";
import { Route } from "@/routes/canvas";
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
  compound: Group,
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

export const ConnectionMenu = ({ screenX, screenY, flowX, flowY, onClose }: Props) => {
  const { t } = useTranslation();
  const { operations, recipes } = Route.useLoaderData();
  const store = useHarnessCanvasStore();
  const connectStart = useStore(store, (s) => s.connectStart);
  const nodes = useStore(store, (s) => s.nodes);
  const storeHandleConnectStart = useStore(store, (s) => s.handleConnectStart);
  const onConnect = useStore(store, (s) => s.handleConnect);
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

    storeHandleConnectStart(null);
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

    storeHandleConnectStart(null);
    onClose();
  };

  const handleSelectRecipe = (recipeId: string) => {
    const recipe = recipes.find((r) => r.id === recipeId);
    if (!recipe) return;
    const operation = operations.find((op) => op.id === recipe.operationId);
    if (!operation) return;

    const newId = `op-recipe-${Date.now()}`;
    addNode({
      id: newId,
      type: "operation",
      position: { x: flowX + 40, y: flowY - 40 },
      data: {
        ...makeOperationNodeData(operation),
        label: recipe.name,
        bestPracticeId: recipe.bestPracticeId,
        bestPracticeName: recipe.name,
      },
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

    storeHandleConnectStart(null);
    onClose();
  };

  if (!sourceNode || availableTypes.length === 0) return null;

  const sourceMeta = nodeTypeMeta[sourceNode.type];
  const SourceIcon = TYPE_ICONS[sourceNode.type];

  // Clamp to viewport edges
  const left = Math.min(screenX, window.innerWidth - 220);
  const top = Math.min(screenY, window.innerHeight - 300);

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
      storeHandleConnectStart(null);
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
        {/* Header */}
        <div className="flex items-center gap-1.5 border-b border-border px-1.5 py-1.5">
          <span
            className={cn(
              "flex size-4 shrink-0 items-center justify-center rounded",
              sourceMeta.iconBg
            )}
          >
            <SourceIcon className="size-2.5 text-white" />
          </span>
          <span className="text-xs font-medium text-foreground">{sourceMeta.label}</span>
          <span className="ml-auto text-xs text-muted-foreground">连接到</span>
        </div>

        {/* Object types */}
        {["code-file", "folder", "github-project"].some((t) =>
          availableTypes.includes(t as NodeType)
        ) && (
          <ContextMenuGroup>
            <ContextMenuLabel>处理对象</ContextMenuLabel>
            {["code-file", "folder", "github-project"]
              .filter((t) => availableTypes.includes(t as NodeType))
              .map((type) => {
                const Icon = TYPE_ICONS[type as NodeType];
                const typeMeta = nodeTypeMeta[type as NodeType];
                return (
                  <ContextMenuItem
                    key={type}
                    closeOnClick={false}
                    onClick={() => handleSelectObject(type as NodeType)}
                  >
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded",
                        typeMeta.iconBg
                      )}
                    >
                      <Icon className="size-2.5 text-white" />
                    </span>
                    <span className="text-xs font-medium text-foreground">{typeMeta.label}</span>
                    <Plus className="ml-auto size-3 text-muted-foreground" />
                  </ContextMenuItem>
                );
              })}
          </ContextMenuGroup>
        )}

        {/* Operations */}
        {canAddOperation && availableOperations.length > 0 && (
          <>
            <ContextMenuSeparator />
            <ContextMenuGroup>
              <ContextMenuLabel>{t("canvas.contextMenu.operationNode")}</ContextMenuLabel>
              {availableOperations.map((operation) => (
                <ContextMenuItem
                  key={operation.id}
                  closeOnClick={false}
                  onClick={() => handleSelectOperation(operation.id)}
                >
                  <span className="flex size-4 shrink-0 items-center justify-center rounded bg-violet-500">
                    <Zap className="size-2.5 text-white" />
                  </span>
                  <span className="truncate text-xs font-medium text-foreground">
                    {operation.name}
                  </span>
                  <Plus className="ml-auto size-3 text-muted-foreground" />
                </ContextMenuItem>
              ))}
            </ContextMenuGroup>
          </>
        )}

        {/* Empty state */}
        {canAddOperation && availableOperations.length === 0 && (
          <>
            <ContextMenuSeparator />
            <ContextMenuGroup>
              <ContextMenuLabel>操作节点</ContextMenuLabel>
              <p className="px-1.5 py-1 text-xs text-muted-foreground">
                {t("canvas.contextMenu.noOperationsForType")}
              </p>
            </ContextMenuGroup>
          </>
        )}

        {/* Recipes */}
        {canAddOperation && recipes.length > 0 && (
          <>
            <ContextMenuSeparator />
            <ContextMenuGroup>
              <ContextMenuLabel>快捷配方</ContextMenuLabel>
              {recipes.map((recipe) => (
                <ContextMenuItem
                  key={recipe.id}
                  closeOnClick={false}
                  onClick={() => handleSelectRecipe(recipe.id)}
                >
                  <span className="flex size-4 shrink-0 items-center justify-center rounded bg-amber-500">
                    <BookOpen className="size-2.5 text-white" />
                  </span>
                  <span className="truncate text-xs font-medium text-foreground">
                    {recipe.name}
                  </span>
                  <Plus className="ml-auto size-3 text-muted-foreground" />
                </ContextMenuItem>
              ))}
            </ContextMenuGroup>
          </>
        )}

        {/* Output node types */}
        {(["output-project-path", "output-local-path"] as NodeType[]).some((t) =>
          availableTypes.includes(t)
        ) && (
          <>
            <ContextMenuSeparator />
            <ContextMenuGroup>
              <ContextMenuLabel>输出终点</ContextMenuLabel>
              {(["output-project-path", "output-local-path"] as NodeType[])
                .filter((t) => availableTypes.includes(t))
                .map((type) => {
                  const Icon = TYPE_ICONS[type];
                  const typeMeta = nodeTypeMeta[type];
                  return (
                    <ContextMenuItem
                      key={type}
                      closeOnClick={false}
                      onClick={() => handleSelectObject(type)}
                    >
                      <span
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded",
                          typeMeta.iconBg
                        )}
                      >
                        <Icon className="size-2.5 text-white" />
                      </span>
                      <span className="text-xs font-medium text-foreground">{typeMeta.label}</span>
                      <Plus className="ml-auto size-3 text-muted-foreground" />
                    </ContextMenuItem>
                  );
                })}
            </ContextMenuGroup>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
};

import {
  ArrowRight,
  FileCode,
  Folder,
  HardDrive,
  FolderOutput,
  Zap,
  BookOpen,
  Group,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { useHarnessCanvasStore } from "../_store";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuLabel,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@repo/ui/context-menu";
import { SiGitHubIcon } from "@/components/icons/SiGitHubIcon";
import { useList } from "@refinedev/core";
import { ResourceName } from "@/integrations/refine/dataProvider";
import type { OperationRecord, RecipeRecord } from "@repo/db-schema";
import { nodeTypeMeta, getAllowedConnections, type NodeType } from "../nodeSchemas";
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

const OBJECT_TYPES: NodeType[] = ["code-file", "folder", "github-project"];

export const CanvasContextMenu = () => {
  const { t } = useTranslation();
  const { result: operationsResult } = useList<OperationRecord>({
    resource: ResourceName.operations,
  });
  const { result: recipesResult } = useList<RecipeRecord>({ resource: ResourceName.recipes });
  const operations = operationsResult?.data ?? [];
  const recipes = recipesResult?.data ?? [];
  const store = useHarnessCanvasStore();
  const contextMenu = useStore(store, (s) => s.contextMenu);
  const connectStart = useStore(store, (s) => s.connectStart);
  const nodes = useStore(store, (s) => s.nodes);
  const handleCreateObjectNode = useStore(store, (s) => s.createObjectNode);
  const createOperationNode = useStore(store, (s) => s.createOperationNode);
  const createRecipeNode = useStore(store, (s) => s.createRecipeNode);
  const handleContextMenuOpenChange = useStore(store, (s) => s.handleContextMenuOpenChange);
  const groupSelectedNodes = useStore(store, (s) => s.groupSelectedNodes);

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

  const handleCreateOperation = (operationId: string) => {
    const operation = operations.find((op) => op.id === operationId);
    if (!operation) return;
    createOperationNode(operation);
  };

  const handleCreateRecipe = (recipeId: string) => {
    const recipe = recipes.find((r) => r.id === recipeId);
    if (!recipe) return;
    const operation = operations.find((op) => op.id === recipe.operationId);
    if (!operation) return;
    createRecipeNode(recipe, operation);
  };

  if (!contextMenu) return null;

  // Clamp to viewport edges
  const left = Math.min(contextMenu.screenX, window.innerWidth - 220);
  const top = Math.min(contextMenu.screenY, window.innerHeight - 300);

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

  const selectedIds = nodes.filter((n) => n.selected && n.type !== "compound").map((n) => n.id);

  const handleGroupSelected = () => {
    groupSelectedNodes(selectedIds);
    handleContextMenuOpenChange(false);
  };

  return (
    <ContextMenu open onOpenChange={handleContextMenuOpenChange}>
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
                nodeTypeMeta[sourceNodeInfo.type].iconBg
              )}
            >
              {(() => {
                const Icon = TYPE_ICONS[sourceNodeInfo.type];
                return <Icon className="size-2.5 text-white" />;
              })()}
            </span>
            <ArrowRight className="size-3 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">连接到...</span>
          </div>
        ) : (
          <div className="px-1.5 py-1 text-xs font-medium text-muted-foreground">新建节点</div>
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
                  onClick={() => handleCreateObjectNode(type)}
                >
                  <span
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded",
                      typeMeta.iconBg
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
              <ContextMenuLabel>{t("canvas.contextMenu.operationNodes")}</ContextMenuLabel>
              {availableOperations.map((operation) => (
                <ContextMenuItem
                  key={operation.id}
                  closeOnClick={false}
                  onClick={() => handleCreateOperation(operation.id)}
                >
                  <span className="flex size-4 shrink-0 items-center justify-center rounded bg-violet-500">
                    <Zap className="size-2.5 text-white" />
                  </span>
                  <span className="truncate text-xs font-medium">{operation.name}</span>
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
              <ContextMenuLabel>{t("canvas.contextMenu.recipeNodes")}</ContextMenuLabel>
              {recipes.map((recipe) => (
                <ContextMenuItem
                  key={recipe.id}
                  closeOnClick={false}
                  onClick={() => handleCreateRecipe(recipe.id)}
                >
                  <span className="flex size-4 shrink-0 items-center justify-center rounded bg-amber-500">
                    <BookOpen className="size-2.5 text-white" />
                  </span>
                  <span className="truncate text-xs font-medium">{recipe.name}</span>
                </ContextMenuItem>
              ))}
            </ContextMenuGroup>
          </>
        )}

        {/* Compound / Group section */}
        <ContextMenuSeparator />
        <ContextMenuGroup>
          <ContextMenuLabel>编组</ContextMenuLabel>
          <ContextMenuItem closeOnClick={false} onClick={() => handleCreateObjectNode("compound")}>
            <span className="flex size-4 shrink-0 items-center justify-center rounded bg-indigo-500">
              <Group className="size-2.5 text-white" />
            </span>
            <span className="text-xs font-medium">新建复合节点</span>
          </ContextMenuItem>
          {(() => {
            if (selectedIds.length < 2) return null;
            return (
              <ContextMenuItem closeOnClick={false} onClick={handleGroupSelected}>
                <span className="flex size-4 shrink-0 items-center justify-center rounded bg-indigo-500">
                  <Group className="size-2.5 text-white" />
                </span>
                <span className="text-xs font-medium">编组 {selectedIds.length} 个选中节点</span>
              </ContextMenuItem>
            );
          })()}
        </ContextMenuGroup>
      </ContextMenuContent>
    </ContextMenu>
  );
};

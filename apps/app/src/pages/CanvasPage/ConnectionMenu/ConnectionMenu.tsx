import { useTranslation } from "react-i18next";
import {
  Plus,
  Zap,
  FileCode,
  Folder,
  HardDrive,
  FolderOutput,
  BookOpen,
  Group,
  GitBranch,
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuLabel,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@repo/ui/context-menu";
import { SiGitHubIcon } from "@/components/icons/SiGitHubIcon";
import { useStore } from "zustand";
import { useHarnessCanvasStore } from "../_store";
import { useList } from "@refinedev/core";
import { ResourceName } from "@/integrations/refine/dataProvider";
import type { Operation, Recipe } from "@repo/schemas";
import { getAllowedConnections } from "../utils/getAllowedConnections";
import { getNodeMeta } from "../utils/nodeTypeMeta";
import type { NodeType, BuiltinNodeType } from "@repo/pipeline-engine/schemas";
import { cn } from "@repo/ui/lib/utils";

const TYPE_ICONS: Record<string, React.ElementType> = {
  operation: Zap,
  compound: Group,
  condition: GitBranch,
  "code-file": FileCode,
  folder: Folder,
  "github-project": SiGitHubIcon,
  "output-project-path": FolderOutput,
  "output-local-path": HardDrive,
};

export const ConnectionMenu = () => {
  const { t } = useTranslation();
  const { result: operationsResult } = useList<Operation>({
    resource: ResourceName.operations,
  });
  const { result: recipesResult } = useList<Recipe>({ resource: ResourceName.recipes });
  const operations = operationsResult?.data;
  const recipes = recipesResult?.data;
  const store = useHarnessCanvasStore();
  const connectionMenu = useStore(store, (s) => s.connectionMenu);
  const connectStart = useStore(store, (s) => s.connectStart);
  const nodes = useStore(store, (s) => s.nodes);
  const handleConnectObjectNode = useStore(store, (s) => s.connectObjectNode);
  const connectOperationNode = useStore(store, (s) => s.connectOperationNode);
  const connectRecipeNode = useStore(store, (s) => s.connectRecipeNode);
  const handleConnectionMenuOpenChange = useStore(store, (s) => s.handleConnectionMenuOpenChange);

  const sourceNode = connectStart ? nodes.find((n) => n.id === connectStart.nodeId) : null;

  const allowedConnections = getAllowedConnections(operations);
  const availableTypes: NodeType[] = sourceNode
    ? (allowedConnections[sourceNode.type as BuiltinNodeType] ?? [])
    : [];

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

  const handleSelectOperation = (operationId: string) => {
    const operation = operations.find((op) => op.id === operationId);
    if (!operation) return;
    connectOperationNode(operation);
  };

  const handleSelectRecipe = (recipeId: string) => {
    const recipe = recipes.find((r) => r.id === recipeId);
    if (!recipe) return;
    const operation = operations.find((op) => op.id === recipe.operationId);
    if (!operation) return;
    connectRecipeNode(recipe, operation);
  };

  if (!connectionMenu || !sourceNode || availableTypes.length === 0) return null;

  const sourceMeta = getNodeMeta(sourceNode.type)!;
  const SourceIcon = TYPE_ICONS[sourceNode.type];

  // Clamp to viewport edges
  const left = Math.min(connectionMenu.screenX, window.innerWidth - 220);
  const top = Math.min(connectionMenu.screenY, window.innerHeight - 300);

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

  return (
    <ContextMenu open onOpenChange={handleConnectionMenuOpenChange}>
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
          availableTypes.includes(t as BuiltinNodeType)
        ) && (
          <ContextMenuGroup>
            <ContextMenuLabel>处理对象</ContextMenuLabel>
            {["code-file", "folder", "github-project"]
              .filter((t) => availableTypes.includes(t as BuiltinNodeType))
              .map((type) => {
                const Icon = TYPE_ICONS[type as NodeType];
                const typeMeta = getNodeMeta(type)!;

                return (
                  <ContextMenuItem
                    key={type}
                    closeOnClick={false}
                    onClick={() => handleConnectObjectNode(type as NodeType)}
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
        {(["output-project-path", "output-local-path"] as BuiltinNodeType[]).some((t) =>
          availableTypes.includes(t)
        ) && (
          <>
            <ContextMenuSeparator />
            <ContextMenuGroup>
              <ContextMenuLabel>输出终点</ContextMenuLabel>
              {(["output-project-path", "output-local-path"] as BuiltinNodeType[])
                .filter((t) => availableTypes.includes(t))
                .map((type) => {
                  const Icon = TYPE_ICONS[type];
                  const typeMeta = getNodeMeta(type)!;

                  return (
                    <ContextMenuItem
                      key={type}
                      closeOnClick={false}
                      onClick={() => handleConnectObjectNode(type)}
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

import { useHotkeys } from "react-hotkeys-hook";
import { useTranslation } from "react-i18next";
import {
  Copy,
  Trash2,
  Zap,
  FileCode,
  Folder,
  FolderOutput,
  HardDrive,
  BookOpen,
  Group,
  Ungroup,
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuLabel,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@repo/ui/context-menu";
import { SiGitHubIcon } from "@/components/icons/SiGitHubIcon";
import { useStore } from "zustand";
import { useHarnessCanvasStore } from "../_store";
import { useList } from "@refinedev/core";
import { ResourceName } from "@/integrations/refine/dataProvider";
import type { OperationEntity, RecipeEntity } from "@repo/models";
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

export const NodeContextMenu = () => {
  const { t } = useTranslation();
  const { result: operationsResult } = useList<OperationEntity>({
    resource: ResourceName.operations,
  });
  const { result: recipesResult } = useList<RecipeEntity>({ resource: ResourceName.recipes });
  const operations = operationsResult?.data ?? [];
  const recipes = recipesResult?.data ?? [];
  const store = useHarnessCanvasStore();
  const nodeContextMenu = useStore(store, (s) => s.nodeContextMenu);
  const nodes = useStore(store, (s) => s.nodes);
  const handleNodeContextDuplicate = useStore(store, (s) => s.nodeContextDuplicate);
  const handleNodeContextDelete = useStore(store, (s) => s.nodeContextDelete);
  const handleNodeContextUngroup = useStore(store, (s) => s.nodeContextUngroup);
  const handleNodeContextDetach = useStore(store, (s) => s.nodeContextDetach);
  const handleNodeContextGroupSelected = useStore(store, (s) => s.nodeContextGroupSelected);
  const handleNodeContextAddObject = useStore(store, (s) => s.nodeContextAddObject);
  const nodeContextAddOperation = useStore(store, (s) => s.nodeContextAddOperation);
  const nodeContextAddRecipe = useStore(store, (s) => s.nodeContextAddRecipe);
  const handleNodeContextMenuOpenChange = useStore(store, (s) => s.handleNodeContextMenuOpenChange);

  const nodeId = nodeContextMenu?.nodeId;
  const node = nodes.find((n) => n.id === nodeId);
  const selectedIds = nodes.filter((n) => n.selected && n.type !== "compound").map((n) => n.id);

  useHotkeys(
    "mod+d",
    (e) => {
      e.preventDefault();
      handleNodeContextDuplicate();
    },
    [handleNodeContextDuplicate]
  );

  if (!nodeContextMenu || !node) return null;

  const meta = nodeTypeMeta[node.type];
  const allowedConnections = getAllowedConnections(operations);
  const availableTypes = allowedConnections[node.type] ?? [];

  // Filter operations based on source type
  const availableOperations = (() => {
    const objectTypeMap: Record<string, string> = {
      "code-file": "file",
      folder: "folder",
      "github-project": "project",
    };
    const objectType = objectTypeMap[node.type];
    if (!objectType) return operations;
    return operations.filter((op) =>
      op.acceptedObjectTypes?.includes(objectType as "file" | "folder" | "project")
    );
  })();

  const canAddOperation = availableTypes.includes("operation");

  const left = Math.min(nodeContextMenu.screenX, window.innerWidth - 232);
  const top = Math.min(nodeContextMenu.screenY, window.innerHeight - 280);

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

  const handleAddOperation = (operationId: string) => {
    const operation = operations.find((op) => op.id === operationId);
    if (!operation) return;
    nodeContextAddOperation(operation);
  };

  const handleAddRecipe = (recipeId: string) => {
    const recipe = recipes.find((r) => r.id === recipeId);
    if (!recipe) return;
    const operation = operations.find((op) => op.id === recipe.operationId);
    if (!operation) return;
    nodeContextAddRecipe(recipe, operation);
  };

  return (
    <ContextMenu open onOpenChange={handleNodeContextMenuOpenChange}>
      <ContextMenuContent
        align="start"
        anchor={virtualAnchor}
        className="w-56"
        positionMethod="fixed"
        side="bottom"
        sideOffset={0}
      >
        {/* Node type header */}
        <div className="mb-1 flex items-center gap-2 border-b border-border px-1.5 py-1.5">
          <span
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold text-white",
              meta.iconBg
            )}
          >
            {meta.shortLabel.charAt(0)}
          </span>
          <span className="text-xs font-medium text-foreground">{meta.label}</span>
        </div>

        {/* Actions submenu */}
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Zap className="size-4 text-muted-foreground" />
            Actions
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="min-w-52">
            <ContextMenuGroup>
              <ContextMenuLabel>连接新节点</ContextMenuLabel>
            </ContextMenuGroup>

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
                    const m = nodeTypeMeta[type as NodeType];
                    return (
                      <ContextMenuItem
                        key={type}
                        closeOnClick={false}
                        onClick={() => handleNodeContextAddObject(type as NodeType)}
                      >
                        <span
                          className={cn(
                            "flex size-4 shrink-0 items-center justify-center rounded",
                            m.iconBg
                          )}
                        >
                          <Icon className="size-2.5 text-white" />
                        </span>
                        {m.shortLabel}
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
                      onClick={() => handleAddOperation(operation.id)}
                    >
                      <span className="flex size-4 shrink-0 items-center justify-center rounded bg-violet-500">
                        <Zap className="size-2.5 text-white" />
                      </span>
                      <span className="truncate">{operation.name}</span>
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
                  <ContextMenuLabel>{t("canvas.contextMenu.operationNode")}</ContextMenuLabel>
                  <p className="px-1.5 py-1 text-xs text-muted-foreground">
                    没有接受此类型的 Operation
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
                      onClick={() => handleAddRecipe(recipe.id)}
                    >
                      <span className="flex size-4 shrink-0 items-center justify-center rounded bg-amber-500">
                        <BookOpen className="size-2.5 text-white" />
                      </span>
                      <span className="truncate">{recipe.name}</span>
                    </ContextMenuItem>
                  ))}
                </ContextMenuGroup>
              </>
            )}

            {/* Output nodes */}
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
                      const m = nodeTypeMeta[type];
                      return (
                        <ContextMenuItem
                          key={type}
                          closeOnClick={false}
                          onClick={() => handleNodeContextAddObject(type)}
                        >
                          <span
                            className={cn(
                              "flex size-4 shrink-0 items-center justify-center rounded",
                              m.iconBg
                            )}
                          >
                            <Icon className="size-2.5 text-white" />
                          </span>
                          {m.label}
                        </ContextMenuItem>
                      );
                    })}
                </ContextMenuGroup>
              </>
            )}
          </ContextMenuSubContent>
        </ContextMenuSub>

        {/* Duplicate */}
        <ContextMenuItem closeOnClick={false} onClick={handleNodeContextDuplicate}>
          <Copy className="size-4 text-muted-foreground" />
          Duplicate
          <span className="ml-auto text-xs tracking-widest text-muted-foreground">⌘D</span>
        </ContextMenuItem>

        {/* Group selected nodes */}
        {selectedIds.length >= 2 && (
          <ContextMenuItem closeOnClick={false} onClick={handleNodeContextGroupSelected}>
            <Group className="size-4 text-muted-foreground" />
            编组 {selectedIds.length} 个选中节点
          </ContextMenuItem>
        )}

        {/* Ungroup (compound only) */}
        {node.type === "compound" && (
          <ContextMenuItem closeOnClick={false} onClick={handleNodeContextUngroup}>
            <Ungroup className="size-4 text-muted-foreground" />
            解散编组
          </ContextMenuItem>
        )}

        {/* Detach from compound (child nodes only) */}
        {node.parentId && (
          <ContextMenuItem closeOnClick={false} onClick={handleNodeContextDetach}>
            <Ungroup className="size-4 text-muted-foreground" />
            从编组中移除
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />

        {/* Delete */}
        <ContextMenuItem
          closeOnClick={false}
          variant="destructive"
          onClick={handleNodeContextDelete}
        >
          <Trash2 className="size-4" />
          Delete
          <span className="ml-auto text-xs tracking-widest text-destructive/40">⌫</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

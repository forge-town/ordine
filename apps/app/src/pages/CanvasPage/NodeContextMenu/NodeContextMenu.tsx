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
  GitBranch,
  MessageSquareText,
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
import type { Operation, Recipe, NodeType, BuiltinNodeType } from "@repo/schemas";
import { getAllowedConnections } from "../utils/getAllowedConnections";
import { getNodeMeta, getNodeTypeLabel, getNodeTypeShortLabel } from "../utils/nodeTypeMeta";
import { cn } from "@repo/ui/lib/utils";

const TYPE_ICONS: Record<string, React.ElementType> = {
  operation: Zap,
  compound: Group,
  condition: GitBranch,
  file: FileCode,
  folder: Folder,
  "github-project": SiGitHubIcon,
  prompt: MessageSquareText,
  "output-project-path": FolderOutput,
  "output-local-path": HardDrive,
};

export const NodeContextMenu = () => {
  const { t } = useTranslation();
  const { result: operationsResult } = useList<Operation>({
    resource: ResourceName.operations,
  });
  const { result: recipesResult } = useList<Recipe>({ resource: ResourceName.recipes });
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
    [handleNodeContextDuplicate],
  );

  if (!nodeContextMenu || !node) return null;

  const meta = getNodeMeta(node.type)!;
  const allowedConnections = getAllowedConnections(operations);
  const availableTypes = allowedConnections[node.type as BuiltinNodeType] ?? [];

  // Filter operations based on source type
  const availableOperations = (() => {
    const objectTypeMap: Record<string, string> = {
      file: "file",
      folder: "folder",
      "github-project": "project",
      prompt: "prompt",
    };
    const objectType = objectTypeMap[node.type];
    if (!objectType) return operations;

    return operations.filter((op) =>
      op.acceptedObjectTypes?.includes(objectType as "file" | "folder" | "project" | "prompt"),
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
              meta.iconBg,
            )}
          >
            {getNodeTypeShortLabel(t, node.type).charAt(0)}
          </span>
          <span className="text-xs font-medium text-foreground">
            {getNodeTypeLabel(t, node.type)}
          </span>
        </div>

        {/* Actions submenu */}
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Zap className="size-4 text-muted-foreground" />
            {t("canvas.contextMenu.actions")}
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="min-w-52">
            <ContextMenuGroup>
              <ContextMenuLabel>{t("canvas.contextMenu.connectNewNode")}</ContextMenuLabel>
            </ContextMenuGroup>

            {/* Object types */}
            {["file", "folder", "github-project", "prompt"].some((t) =>
              availableTypes.includes(t as BuiltinNodeType),
            ) && (
              <ContextMenuGroup>
                <ContextMenuLabel>{t("canvas.contextMenu.processingObject")}</ContextMenuLabel>
                {["file", "folder", "github-project", "prompt"]
                  .filter((t) => availableTypes.includes(t as BuiltinNodeType))
                  .map((type) => {
                    const Icon = TYPE_ICONS[type as NodeType];
                    const m = getNodeMeta(type)!;

                    return (
                      <ContextMenuItem
                        key={type}
                        closeOnClick={false}
                        onClick={() => handleNodeContextAddObject(type as NodeType)}
                      >
                        <span
                          className={cn(
                            "flex size-4 shrink-0 items-center justify-center rounded",
                            m.iconBg,
                          )}
                        >
                          <Icon className="size-2.5 text-white" />
                        </span>
                        {getNodeTypeShortLabel(t, type)}
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
                  <ContextMenuLabel>{t("canvas.contextMenu.recipeNode")}</ContextMenuLabel>
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
            {(["output-project-path", "output-local-path"] as BuiltinNodeType[]).some((t) =>
              availableTypes.includes(t),
            ) && (
              <>
                <ContextMenuSeparator />
                <ContextMenuGroup>
                  <ContextMenuLabel>{t("canvas.contextMenu.outputEndpoint")}</ContextMenuLabel>
                  {(["output-project-path", "output-local-path"] as BuiltinNodeType[])
                    .filter((t) => availableTypes.includes(t))
                    .map((type) => {
                      const Icon = TYPE_ICONS[type];
                      const m = getNodeMeta(type)!;

                      return (
                        <ContextMenuItem
                          key={type}
                          closeOnClick={false}
                          onClick={() => handleNodeContextAddObject(type)}
                        >
                          <span
                            className={cn(
                              "flex size-4 shrink-0 items-center justify-center rounded",
                              m.iconBg,
                            )}
                          >
                            <Icon className="size-2.5 text-white" />
                          </span>
                          {getNodeTypeLabel(t, type)}
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
          {t("canvas.contextMenu.duplicate")}
          <span className="ml-auto text-xs tracking-widest text-muted-foreground">⌘D</span>
        </ContextMenuItem>

        {/* Group selected nodes */}
        {selectedIds.length >= 2 && (
          <ContextMenuItem closeOnClick={false} onClick={handleNodeContextGroupSelected}>
            <Group className="size-4 text-muted-foreground" />
            {t("canvas.contextMenu.groupSelected", { count: selectedIds.length })}
          </ContextMenuItem>
        )}

        {/* Ungroup (compound only) */}
        {node.type === "compound" && (
          <ContextMenuItem closeOnClick={false} onClick={handleNodeContextUngroup}>
            <Ungroup className="size-4 text-muted-foreground" />
            {t("canvas.contextMenu.ungroup")}
          </ContextMenuItem>
        )}

        {/* Detach from compound (child nodes only) */}
        {node.parentId && (
          <ContextMenuItem closeOnClick={false} onClick={handleNodeContextDetach}>
            <Ungroup className="size-4 text-muted-foreground" />
            {t("canvas.contextMenu.detachFromGroup")}
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
          {t("canvas.contextMenu.delete")}
          <span className="ml-auto text-xs tracking-widest text-destructive/40">⌫</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

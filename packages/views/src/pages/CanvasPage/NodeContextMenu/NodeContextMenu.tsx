import { useHotkeys } from "react-hotkeys-hook";
import { useTranslation } from "react-i18next";
import {
  Copy,
  Trash2,
  Plus,
  Zap,
  FileCode,
  Folder,
  FolderOutput,
  HardDrive,
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
import { SiGitHubIcon } from "../../../components/icons/SiGitHubIcon";
import { useStore } from "zustand";
import { useCanvasPageStore } from "../_store";
import { useList } from "@refinedev/core";
import { ResourceName } from "../../../constants";
import type { Operation, BuiltinNodeType } from "@repo/schemas";
import { getAllowedConnections } from "../utils/getAllowedConnections";
import { getNodeTypeLabel, getNodeTypeShortLabel } from "../utils/nodeTypeMeta";

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
  const operations = operationsResult.data;
  const store = useCanvasPageStore();
  const nodeContextMenu = useStore(store, (s) => s.nodeContextMenu);
  const nodes = useStore(store, (s) => s.nodes);
  const handleNodeContextDuplicate = useStore(store, (s) => s.nodeContextDuplicate);
  const handleNodeContextDelete = useStore(store, (s) => s.nodeContextDelete);
  const handleNodeContextUngroup = useStore(store, (s) => s.nodeContextUngroup);
  const handleNodeContextDetach = useStore(store, (s) => s.nodeContextDetach);
  const handleNodeContextGroupSelected = useStore(store, (s) => s.nodeContextGroupSelected);
  const handleNodeContextAddObject = useStore(store, (s) => s.nodeContextAddObject);
  const nodeContextAddOperation = useStore(store, (s) => s.nodeContextAddOperation);
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

  const allowedConnections = getAllowedConnections(operations);
  const availableTypes = allowedConnections[node.type as BuiltinNodeType] ?? [];

  // Filter operations based on source type
  const availableOperations = (() => {
    const objectTypeMap: Record<string, string> = {
      file: "file",
      folder: "folder",
      "github-project": "github-project",
      prompt: "prompt",
    };
    const objectType = objectTypeMap[node.type];
    if (!objectType) return operations;

    return operations.filter((op) =>
      op.acceptedObjectTypes?.includes(
        objectType as "file" | "folder" | "github-project" | "prompt",
      ),
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

  return (
    <ContextMenu open onOpenChange={handleNodeContextMenuOpenChange}>
      <ContextMenuContent
        align="start"
        anchor={virtualAnchor}
        className="w-56 rounded-2xl border border-border bg-surface p-2 shadow-float ring-1 ring-border"
        positionMethod="fixed"
        side="bottom"
        sideOffset={0}
      >
        {/* Node type header */}
        <div className="mb-1 flex items-center gap-2 border-b border-border px-2 pb-2 pt-1">
          <span className="flex size-5 items-center justify-center rounded-md bg-surface-2 text-[9px] font-bold text-foreground/70">
            {getNodeTypeShortLabel(t, node.type).charAt(0)}
          </span>
          <span className="text-xs font-medium text-foreground">
            {getNodeTypeLabel(t, node.type)}
          </span>
        </div>

        {/* Actions submenu */}
        <ContextMenuSub>
          <ContextMenuSubTrigger className="rounded-lg px-2 py-1.5 text-xs">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-surface-2">
              <Zap className="size-3 text-foreground/70" />
            </span>
            {t("canvas.contextMenu.actions")}
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="min-w-52 rounded-2xl border border-border bg-surface p-2 shadow-float ring-1 ring-border">
            <ContextMenuGroup>
              <ContextMenuLabel className="px-2 py-1 text-[9.5px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                {t("canvas.contextMenu.connectNewNode")}
              </ContextMenuLabel>
            </ContextMenuGroup>

            {/* Object types */}
            {["file", "folder", "github-project", "prompt"].some((t) =>
              availableTypes.includes(t as BuiltinNodeType),
            ) && (
              <ContextMenuGroup>
                <ContextMenuLabel className="px-2 py-1 text-[9.5px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                  {t("canvas.contextMenu.processingObject")}
                </ContextMenuLabel>
                {["file", "folder", "github-project", "prompt"]
                  .filter((t) => availableTypes.includes(t as BuiltinNodeType))
                  .map((type) => {
                    const Icon = TYPE_ICONS[type as BuiltinNodeType];

                    return (
                      <ContextMenuItem
                        key={type}
                        className="rounded-lg px-2 py-1.5 text-xs"
                        closeOnClick={false}
                        onClick={() => handleNodeContextAddObject(type as BuiltinNodeType)}
                      >
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-surface-2">
                          <Icon className="size-3 text-foreground/70" />
                        </span>
                        {getNodeTypeShortLabel(t, type)}
                        <Plus className="ml-auto size-3 text-muted-foreground/50" />
                      </ContextMenuItem>
                    );
                  })}
              </ContextMenuGroup>
            )}

            {/* Operations */}
            {canAddOperation && availableOperations.length > 0 && (
              <>
                <ContextMenuSeparator className="my-1 bg-border/70" />
                <ContextMenuGroup>
                  <ContextMenuLabel className="px-2 py-1 text-[9.5px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                    {t("canvas.contextMenu.operationNode")}
                  </ContextMenuLabel>
                  {availableOperations.map((operation) => (
                    <ContextMenuItem
                      key={operation.id}
                      className="rounded-lg px-2 py-1.5 text-xs"
                      closeOnClick={false}
                      onClick={() => handleAddOperation(operation.id)}
                    >
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-surface-2">
                        <Zap className="size-3 text-foreground/70" />
                      </span>
                      <span className="truncate">{operation.name}</span>
                      <Plus className="ml-auto size-3 text-muted-foreground/50" />
                    </ContextMenuItem>
                  ))}
                </ContextMenuGroup>
              </>
            )}

            {/* Empty state */}
            {canAddOperation && availableOperations.length === 0 && (
              <>
                <ContextMenuSeparator className="my-1 bg-border/70" />
                <ContextMenuGroup>
                  <ContextMenuLabel className="px-2 py-1 text-[9.5px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                    {t("canvas.contextMenu.operationNode")}
                  </ContextMenuLabel>
                  <p className="px-2 py-1 text-xs text-muted-foreground">
                    {t("canvas.contextMenu.noOperationsForType")}
                  </p>
                </ContextMenuGroup>
              </>
            )}

            {/* Output nodes */}
            {(["output-project-path", "output-local-path"] as BuiltinNodeType[]).some((t) =>
              availableTypes.includes(t),
            ) && (
              <>
                <ContextMenuSeparator className="my-1 bg-border/70" />
                <ContextMenuGroup>
                  <ContextMenuLabel className="px-2 py-1 text-[9.5px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                    {t("canvas.contextMenu.outputEndpoint")}
                  </ContextMenuLabel>
                  {(["output-project-path", "output-local-path"] as BuiltinNodeType[])
                    .filter((t) => availableTypes.includes(t))
                    .map((type) => {
                      const Icon = TYPE_ICONS[type];

                      return (
                        <ContextMenuItem
                          key={type}
                          className="rounded-lg px-2 py-1.5 text-xs"
                          closeOnClick={false}
                          onClick={() => handleNodeContextAddObject(type)}
                        >
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-surface-2">
                            <Icon className="size-3 text-foreground/70" />
                          </span>
                          {getNodeTypeLabel(t, type)}
                          <Plus className="ml-auto size-3 text-muted-foreground/50" />
                        </ContextMenuItem>
                      );
                    })}
                </ContextMenuGroup>
              </>
            )}
          </ContextMenuSubContent>
        </ContextMenuSub>

        {/* Duplicate */}
        <ContextMenuItem
          className="rounded-lg px-2 py-1.5 text-xs"
          closeOnClick={false}
          onClick={handleNodeContextDuplicate}
        >
          <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-surface-2">
            <Copy className="size-3 text-foreground/70" />
          </span>
          {t("canvas.contextMenu.duplicate")}
          <span className="ml-auto text-xs tracking-widest text-muted-foreground">⌘D</span>
        </ContextMenuItem>

        {/* Group selected nodes */}
        {selectedIds.length >= 2 && (
          <ContextMenuItem
            className="rounded-lg px-2 py-1.5 text-xs"
            closeOnClick={false}
            onClick={handleNodeContextGroupSelected}
          >
            <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-surface-2">
              <Group className="size-3 text-foreground/70" />
            </span>
            {t("canvas.contextMenu.groupSelected", { count: selectedIds.length })}
          </ContextMenuItem>
        )}

        {/* Ungroup (compound only) */}
        {node.type === "compound" && (
          <ContextMenuItem
            className="rounded-lg px-2 py-1.5 text-xs"
            closeOnClick={false}
            variant="destructive"
            onClick={handleNodeContextUngroup}
          >
            <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-destructive/10">
              <Ungroup className="size-3 text-destructive" />
            </span>
            {t("canvas.contextMenu.ungroup")}
          </ContextMenuItem>
        )}

        {/* Detach from compound (child nodes only) */}
        {node.parentId && (
          <ContextMenuItem
            className="rounded-lg px-2 py-1.5 text-xs"
            closeOnClick={false}
            onClick={handleNodeContextDetach}
          >
            <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-surface-2">
              <Ungroup className="size-3 text-foreground/70" />
            </span>
            {t("canvas.contextMenu.detachFromGroup")}
          </ContextMenuItem>
        )}

        <ContextMenuSeparator className="my-1 bg-border/70" />

        {/* Delete */}
        <ContextMenuItem
          className="rounded-lg px-2 py-1.5 text-xs"
          closeOnClick={false}
          variant="destructive"
          onClick={handleNodeContextDelete}
        >
          <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-destructive/10">
            <Trash2 className="size-3 text-destructive" />
          </span>
          {t("canvas.contextMenu.delete")}
          <span className="ml-auto text-xs tracking-widest text-destructive/40">⌫</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

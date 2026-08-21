import {
  ArrowRight,
  FileCode,
  Folder,
  HardDrive,
  FolderOutput,
  Zap,
  Group,
  GitBranch,
  MessageSquareText,
  Plus,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { useCanvasPageStore } from "../_store";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuLabel,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@repo/ui/context-menu";
import { SiGitHubIcon } from "../../../components/icons/SiGitHubIcon";
import { useList } from "@refinedev/core";
import { ResourceName } from "../../../constants";
import type { Operation, BuiltinNodeType } from "@repo/schemas";
import { getAllowedConnections } from "../utils/getAllowedConnections";
import { getNodeTypeLabel } from "../utils/nodeTypeMeta";

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

const OBJECT_TYPES: BuiltinNodeType[] = ["file", "folder", "github-project", "prompt"];

export const CanvasContextMenu = () => {
  const { t } = useTranslation();
  const { result: operationsResult } = useList<Operation>({
    resource: ResourceName.operations,
  });
  const operations = operationsResult.data;
  const store = useCanvasPageStore();
  const contextMenu = useStore(store, (s) => s.contextMenu);
  const connectStart = useStore(store, (s) => s.connectStart);
  const nodes = useStore(store, (s) => s.nodes);
  const handleCreateObjectNode = useStore(store, (s) => s.createObjectNode);
  const createOperationNode = useStore(store, (s) => s.createOperationNode);
  const handleContextMenuOpenChange = useStore(store, (s) => s.handleContextMenuOpenChange);
  const groupSelectedNodes = useStore(store, (s) => s.groupSelectedNodes);

  // Get allowed connections based on current operations
  const allowedConnections = getAllowedConnections(operations);

  // Determine available node types
  const availableTypes = (() => {
    if (!connectStart) return [...OBJECT_TYPES, "operation"] as BuiltinNodeType[];

    const sourceNode = nodes.find((n) => n.id === connectStart.nodeId);
    if (!sourceNode) return [...OBJECT_TYPES, "operation"] as BuiltinNodeType[];
    // Return allowed target types for the source node
    return allowedConnections[sourceNode.type as BuiltinNodeType] ?? [];
  })();

  // Filter operations based on source type (if in connect mode)
  const availableOperations = (() => {
    if (!connectStart) return operations;

    const sourceNode = nodes.find((n) => n.id === connectStart.nodeId);
    if (!sourceNode) return operations;

    // Map node type to object type
    const objectTypeMap: Record<string, string> = {
      file: "file",
      folder: "folder",
      "github-project": "github-project",
      prompt: "prompt",
    };
    const objectType = objectTypeMap[sourceNode.type];
    if (!objectType) return operations;
    // Only show operations that accept this object type
    return operations.filter((op) =>
      op.acceptedObjectTypes?.includes(
        objectType as "file" | "folder" | "github-project" | "prompt",
      ),
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

  if (!contextMenu) return null;

  // Clamp to viewport edges
  const left = Math.min(contextMenu.screenX, window.innerWidth - 220);
  const top = Math.min(contextMenu.screenY, window.innerHeight - 300);

  // Get source node info for display
  const sourceNodeInfo = (() => {
    if (!connectStart) return null;
    const node = nodes.find((n) => n.id === connectStart.nodeId);

    return node ? { type: node.type, label: getNodeTypeLabel(t, node.type) } : null;
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
        className="max-h-[80vh] min-w-50 rounded-2xl border border-border bg-surface p-2 shadow-float ring-1 ring-border"
        positionMethod="fixed"
        side="bottom"
        sideOffset={0}
      >
        {isConnectMode && sourceNodeInfo ? (
          <div className="mb-1 flex items-center gap-2 border-b border-border px-2 pb-2 pt-1">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-surface-2">
              {(() => {
                const Icon = TYPE_ICONS[sourceNodeInfo.type];

                return <Icon className="size-3 text-foreground/70" />;
              })()}
            </span>
            <ArrowRight className="size-3 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">
              {t("canvas.contextMenu.connectTo")}
            </span>
          </div>
        ) : (
          <div className="mb-1 border-b border-border px-2 pb-2 pt-1 text-xs font-medium text-muted-foreground">
            {t("canvas.contextMenu.newNode")}
          </div>
        )}

        {/* Object types group */}
        {visibleObjectTypes.length > 0 && (
          <ContextMenuGroup>
            <ContextMenuLabel className="px-2 py-1 text-[9.5px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
              {t("canvas.contextMenu.objectTypes")}
            </ContextMenuLabel>
            {visibleObjectTypes.map((type) => {
              const Icon = TYPE_ICONS[type];
              const typeLabel = getNodeTypeLabel(t, type);

              return (
                <ContextMenuItem
                  key={type}
                  className="rounded-lg px-2 py-1.5 text-xs"
                  closeOnClick={false}
                  onClick={() => handleCreateObjectNode(type)}
                >
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-surface-2">
                    <Icon className="size-3 text-foreground/70" />
                  </span>
                  <span className="text-xs font-medium">{typeLabel}</span>
                  <Plus className="ml-auto size-3 text-muted-foreground/50" />
                </ContextMenuItem>
              );
            })}
          </ContextMenuGroup>
        )}

        {/* Operations group */}
        {canAddOperation && availableOperations.length > 0 && (
          <>
            <ContextMenuSeparator className="my-1 bg-border/70" />
            <ContextMenuGroup>
              <ContextMenuLabel className="px-2 py-1 text-[9.5px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                {t("canvas.contextMenu.operationNodes")}
              </ContextMenuLabel>
              {availableOperations.map((operation) => (
                <ContextMenuItem
                  key={operation.id}
                  className="rounded-lg px-2 py-1.5 text-xs"
                  closeOnClick={false}
                  onClick={() => handleCreateOperation(operation.id)}
                >
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-surface-2">
                    <Zap className="size-3 text-foreground/70" />
                  </span>
                  <span className="truncate text-xs font-medium">{operation.name}</span>
                  <Plus className="ml-auto size-3 text-muted-foreground/50" />
                </ContextMenuItem>
              ))}
            </ContextMenuGroup>
          </>
        )}

        {/* Empty state for operations */}
        {canAddOperation && availableOperations.length === 0 && (
          <>
            <ContextMenuSeparator className="my-1 bg-border/70" />
            <ContextMenuGroup>
              <ContextMenuLabel className="px-2 py-1 text-[9.5px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                {t("canvas.contextMenu.operationNodes")}
              </ContextMenuLabel>
              <p className="px-2 py-1 text-xs text-muted-foreground">
                {t("canvas.contextMenu.noOperationsForType")}
              </p>
            </ContextMenuGroup>
          </>
        )}

        {/* Compound / Group section */}
        <ContextMenuSeparator className="my-1 bg-border/70" />
        <ContextMenuGroup>
          <ContextMenuLabel className="px-2 py-1 text-[9.5px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
            {t("canvas.contextMenu.group")}
          </ContextMenuLabel>
          <ContextMenuItem
            className="rounded-lg px-2 py-1.5 text-xs"
            closeOnClick={false}
            onClick={() => handleCreateObjectNode("compound")}
          >
            <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-surface-2">
              <Group className="size-3 text-foreground/70" />
            </span>
            <span className="text-xs font-medium">{t("canvas.contextMenu.newCompoundNode")}</span>
            <Plus className="ml-auto size-3 text-muted-foreground/50" />
          </ContextMenuItem>
          {(() => {
            if (selectedIds.length < 2) return null;

            return (
              <ContextMenuItem
                className="rounded-lg px-2 py-1.5 text-xs"
                closeOnClick={false}
                onClick={handleGroupSelected}
              >
                <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-surface-2">
                  <Group className="size-3 text-foreground/70" />
                </span>
                <span className="text-xs font-medium">
                  {t("canvas.contextMenu.groupSelected", { count: selectedIds.length })}
                </span>
              </ContextMenuItem>
            );
          })()}
        </ContextMenuGroup>
      </ContextMenuContent>
    </ContextMenu>
  );
};

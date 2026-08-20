import { useTranslation } from "react-i18next";
import {
  Plus,
  Zap,
  FileCode,
  Folder,
  HardDrive,
  FolderOutput,
  Group,
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
} from "@repo/ui/context-menu";
import { SiGitHubIcon } from "../../../components/icons/SiGitHubIcon";
import { useStore } from "zustand";
import { useCanvasPageStore } from "../_store";
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

export const ConnectionMenu = () => {
  const { t } = useTranslation();
  const { result: operationsResult } = useList<Operation>({
    resource: ResourceName.operations,
  });
  const operations = operationsResult?.data;
  const store = useCanvasPageStore();
  const connectionMenu = useStore(store, (s) => s.connectionMenu);
  const connectStart = useStore(store, (s) => s.connectStart);
  const nodes = useStore(store, (s) => s.nodes);
  const handleConnectObjectNode = useStore(store, (s) => s.connectObjectNode);
  const connectOperationNode = useStore(store, (s) => s.connectOperationNode);
  const handleConnectionMenuOpenChange = useStore(store, (s) => s.handleConnectionMenuOpenChange);

  const sourceNode = connectStart ? nodes.find((n) => n.id === connectStart.nodeId) : null;

  const allowedConnections = getAllowedConnections(operations);
  const availableTypes: BuiltinNodeType[] = sourceNode
    ? (allowedConnections[sourceNode.type as BuiltinNodeType] ?? [])
    : [];

  // Filter operations based on source type
  const availableOperations = (() => {
    if (!sourceNode) return operations;
    const objectTypeMap: Record<string, string> = {
      file: "file",
      folder: "folder",
      "github-project": "github-project",
      prompt: "prompt",
    };
    const objectType = objectTypeMap[sourceNode.type];
    if (!objectType) return operations;

    return operations.filter((op) =>
      op.acceptedObjectTypes?.includes(
        objectType as "file" | "folder" | "github-project" | "prompt",
      ),
    );
  })();

  const canAddOperation = availableTypes.includes("operation");

  const handleSelectOperation = (operationId: string) => {
    const operation = operations.find((op) => op.id === operationId);
    if (!operation) return;
    connectOperationNode(operation);
  };

  if (!connectionMenu || !sourceNode || availableTypes.length === 0) return null;

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
        className="max-h-[80vh] min-w-50 rounded-2xl border border-border bg-surface p-2 shadow-float ring-1 ring-border"
        positionMethod="fixed"
        side="bottom"
        sideOffset={0}
      >
        {/* Header */}
        <div className="mb-1 flex items-center gap-1.5 border-b border-border px-2 pb-2 pt-1">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-surface-2">
            <SourceIcon className="size-3 text-foreground/70" />
          </span>
          <span className="text-xs font-medium text-foreground">
            {getNodeTypeLabel(t, sourceNode.type)}
          </span>
          <span className="ml-auto text-xs text-muted-foreground">
            {t("canvas.contextMenu.connectTo")}
          </span>
        </div>

        {/* Object types */}
        {["file", "folder", "github-project"].some((t) =>
          availableTypes.includes(t as BuiltinNodeType),
        ) && (
          <ContextMenuGroup>
            <ContextMenuLabel className="px-2 py-1 text-[9.5px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
              {t("canvas.contextMenu.processingObject")}
            </ContextMenuLabel>
            {["file", "folder", "github-project"]
              .filter((t) => availableTypes.includes(t as BuiltinNodeType))
              .map((type) => {
                const Icon = TYPE_ICONS[type as BuiltinNodeType];

                return (
                  <ContextMenuItem
                    key={type}
                    className="rounded-lg px-2 py-1.5 text-xs"
                    closeOnClick={false}
                    onClick={() => handleConnectObjectNode(type as BuiltinNodeType)}
                  >
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-surface-2">
                      <Icon className="size-3 text-foreground/70" />
                    </span>
                    <span className="text-xs font-medium text-foreground">
                      {getNodeTypeLabel(t, type)}
                    </span>
                    <Plus className="ml-auto size-3 text-muted-foreground" />
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
                  onClick={() => handleSelectOperation(operation.id)}
                >
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-surface-2">
                    <Zap className="size-3 text-foreground/70" />
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

        {/* Output node types */}
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
                      onClick={() => handleConnectObjectNode(type)}
                    >
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-surface-2">
                        <Icon className="size-3 text-foreground/70" />
                      </span>
                      <span className="text-xs font-medium text-foreground">
                        {getNodeTypeLabel(t, type)}
                      </span>
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

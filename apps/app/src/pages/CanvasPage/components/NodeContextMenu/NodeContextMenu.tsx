import { useEffect } from "react";
import { useStore } from "zustand";
import {
  Copy,
  Trash2,
  Zap,
  FileCode,
  Folder,
  FolderOutput,
  HardDrive,
  BookOpen,
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
import { SiGitHubIcon } from "../../nodes/GitHubProjectNode/SiGitHubIcon";
import { useHarnessCanvasStore } from "../../_store";
import { Route } from "@/routes/canvas";
import {
  nodeTypeMeta,
  makeDefaultNodeData,
  makeOperationNodeData,
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

interface Props {
  screenX: number;
  screenY: number;
  nodeId: string;
  onClose: () => void;
}

export const NodeContextMenu = ({ screenX, screenY, nodeId, onClose }: Props) => {
  const { operations, recipes } = Route.useLoaderData();
  const store = useHarnessCanvasStore();
  const nodes = useStore(store, (s) => s.nodes);
  const duplicateNode = useStore(store, (s) => s.duplicateNode);
  const removeNode = useStore(store, (s) => s.removeNode);
  const addNode = useStore(store, (s) => s.addNode);
  const onConnect = useStore(store, (s) => s.handleConnect);
  const node = nodes.find((n) => n.id === nodeId);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "d" && e.metaKey) {
        e.preventDefault();
        duplicateNode(nodeId);
        onClose();
      }
    };
    globalThis.addEventListener("keydown", handler);
    return () => globalThis.removeEventListener("keydown", handler);
  }, [onClose, duplicateNode, nodeId]);

  if (!node) return null;

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

  const left = Math.min(screenX, window.innerWidth - 232);
  const top = Math.min(screenY, window.innerHeight - 280);

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

  const handleDuplicate = () => {
    duplicateNode(nodeId);
    onClose();
  };

  const handleDelete = () => {
    removeNode(nodeId);
    onClose();
  };

  const handleAddObject = (type: NodeType) => {
    const newId = `${type}-${Date.now()}`;
    addNode({
      id: newId,
      type,
      position: { x: node.position.x + 280, y: node.position.y },
      data: makeDefaultNodeData(type),
    });
    onConnect({
      source: nodeId,
      sourceHandle: null,
      target: newId,
      targetHandle: null,
    });
    onClose();
  };

  const handleAddOperation = (operationId: string) => {
    const operation = operations.find((op) => op.id === operationId);
    if (!operation) return;

    const newId = `op-${operationId}-${Date.now()}`;
    addNode({
      id: newId,
      type: "operation",
      position: { x: node.position.x + 280, y: node.position.y },
      data: makeOperationNodeData(operation),
    });
    onConnect({
      source: nodeId,
      sourceHandle: null,
      target: newId,
      targetHandle: null,
    });
    onClose();
  };

  const handleAddRecipe = (recipeId: string) => {
    const recipe = recipes.find((r) => r.id === recipeId);
    if (!recipe) return;
    const operation = operations.find((op) => op.id === recipe.operationId);
    if (!operation) return;

    const newId = `op-recipe-${Date.now()}`;
    addNode({
      id: newId,
      type: "operation",
      position: { x: node.position.x + 280, y: node.position.y },
      data: {
        ...makeOperationNodeData(operation),
        label: recipe.name,
        bestPracticeId: recipe.bestPracticeId,
        bestPracticeName: recipe.name,
      },
    });
    onConnect({
      source: nodeId,
      sourceHandle: null,
      target: newId,
      targetHandle: null,
    });
    onClose();
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) onClose();
  };

  return (
    <ContextMenu open onOpenChange={handleOpenChange}>
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
            <ContextMenuLabel>连接新节点</ContextMenuLabel>

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
                        onClick={() => handleAddObject(type as NodeType)}
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
                  <ContextMenuLabel>操作节点</ContextMenuLabel>
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
                  <ContextMenuLabel>操作节点</ContextMenuLabel>
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
                          onClick={() => handleAddObject(type)}
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
        <ContextMenuItem closeOnClick={false} onClick={handleDuplicate}>
          <Copy className="size-4 text-muted-foreground" />
          Duplicate
          <span className="ml-auto text-xs tracking-widest text-muted-foreground">⌘D</span>
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* Delete */}
        <ContextMenuItem closeOnClick={false} variant="destructive" onClick={handleDelete}>
          <Trash2 className="size-4" />
          Delete
          <span className="ml-auto text-xs tracking-widest text-destructive/40">⌫</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

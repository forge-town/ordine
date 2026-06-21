import { useRef, type DragEvent } from "react";
import { useList } from "@refinedev/core";
import { useReactFlow } from "@xyflow/react";
import {
  Boxes,
  File,
  FolderGit2,
  FolderOpen,
  GitFork,
  HardDrive,
  MessageSquare,
  Plus,
  Split,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@repo/ui/lib/utils";
import type { CompoundNodeData, Operation } from "@repo/schemas";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { useCanvasStore } from "../_store/canvasStore";
import {
  CANVAS_COMPONENT_DRAG_MIME,
  encodeCanvasComponentDragPayload,
  type CanvasComponentDragPayload,
} from "../utils/canvasComponentDragPayload";
import { makeDefaultNodeData } from "../utils/makeDefaultNodeData";
import { makeOperationNodeData } from "../utils/makeOperationNodeData";

type PaletteEntry = {
  icon: LucideIcon;
  id: string;
  label: string;
  payload: CanvasComponentDragPayload;
};

const OBJECT_ENTRIES: ReadonlyArray<{
  icon: LucideIcon;
  type: "file" | "folder" | "github-project" | "prompt";
}> = [
  { icon: FolderOpen, type: "folder" },
  { icon: File, type: "file" },
  { icon: FolderGit2, type: "github-project" },
  { icon: MessageSquare, type: "prompt" },
];

const COMPOUND_ENTRIES: ReadonlyArray<{
  icon: LucideIcon;
  kind: "council" | "delegation" | "verify";
}> = [
  { icon: GitFork, kind: "verify" },
  { icon: Users, kind: "council" },
  { icon: Split, kind: "delegation" },
];

const OUTPUT_ENTRIES: ReadonlyArray<{
  icon: LucideIcon;
  type: "output-local-path" | "output-project-path";
}> = [
  { icon: HardDrive, type: "output-local-path" },
  { icon: Boxes, type: "output-project-path" },
];

export const ComponentPanel = () => {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const compPanelOpen = useCanvasStore((state) => state.compPanelOpen);
  const toggleCompPanelOpen = useCanvasStore((state) => state.toggleCompPanelOpen);
  const nodes = useCanvasStore((state) => state.nodes);
  const edges = useCanvasStore((state) => state.edges);
  const addNodeFromCatalog = useCanvasStore((state) => state.addNodeFromCatalog);
  const recordHistory = useCanvasStore((state) => state.recordHistory);
  const drillStack = useCanvasStore((state) => state.drillStack);
  const { screenToFlowPosition } = useReactFlow();
  const { result: operationsResult } = useList<Operation>({
    resource: ResourceName.operations,
  });
  const operations = operationsResult.data;

  if (drillStack.length > 0) {
    return null;
  }

  const groups: ReadonlyArray<{ entries: PaletteEntry[]; key: string }> = [
    {
      entries: OBJECT_ENTRIES.map(({ icon, type }) => ({
        icon,
        id: `object-${type}`,
        label: t(`workspace.canvas.chrome.components.items.${type}`),
        payload: { kind: "object", type },
      })),
      key: "inputObjects",
    },
    {
      entries: operations.map((operation) => ({
        icon: Workflow,
        id: `operation-${operation.id}`,
        label: operation.name,
        payload: { kind: "operation", operation },
      })),
      key: "operations",
    },
    {
      entries: COMPOUND_ENTRIES.map(({ icon, kind }) => ({
        icon,
        id: `compound-${kind}`,
        label: t(`workspace.canvas.chrome.components.items.${kind}`),
        payload: { compoundKind: kind, kind: "compound" },
      })),
      key: "compound",
    },
    {
      entries: OUTPUT_ENTRIES.map(({ icon, type }) => ({
        icon,
        id: `output-${type}`,
        label: t(`workspace.canvas.chrome.components.items.${type}`),
        payload: { kind: "object", type },
      })),
      key: "output",
    },
  ];

  const centerPosition = () => {
    const root = panelRef.current?.closest('[data-testid="canvas-v2-root"]');
    const rect = root?.getBoundingClientRect();
    const jitter = () => Math.random() * 40 - 20;

    return screenToFlowPosition({
      x: (rect ? rect.left + rect.width / 2 : window.innerWidth / 2) + jitter(),
      y: (rect ? rect.top + rect.height / 2 : window.innerHeight / 2) + jitter(),
    });
  };

  const addEntry = (payload: CanvasComponentDragPayload) => {
    const previous = { edges, nodes };
    const position = centerPosition();

    if (payload.kind === "object") {
      addNodeFromCatalog({ position, type: payload.type });
    } else if (payload.kind === "operation") {
      addNodeFromCatalog({
        data: makeOperationNodeData(payload.operation),
        position,
        type: "operation",
      });
    } else if (payload.kind === "compound") {
      addNodeFromCatalog({
        data: {
          ...(makeDefaultNodeData("compound", {
            label: payload.compoundKind,
          }) as CompoundNodeData),
          compoundKind: payload.compoundKind,
        },
        position,
        type: "compound",
      });
    } else {
      return;
    }
    recordHistory(previous);
  };

  const handleDragStart = (
    event: DragEvent<HTMLButtonElement>,
    payload: CanvasComponentDragPayload,
  ) => {
    event.dataTransfer.setData(
      CANVAS_COMPONENT_DRAG_MIME,
      encodeCanvasComponentDragPayload(payload),
    );
    event.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div ref={panelRef} className="pointer-events-auto absolute left-3 top-16 z-10">
      <button
        className={cn(
          "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs shadow-pill ring-1 transition-colors",
          compPanelOpen
            ? "bg-foreground text-background ring-foreground"
            : "bg-surface ring-border hover:ring-border-strong",
        )}
        data-testid="canvas-v2-components-toggle"
        type="button"
        onClick={toggleCompPanelOpen}
      >
        <Boxes className="size-3.5" />
        {t("workspace.canvas.chrome.components.trigger")}
      </button>
      {compPanelOpen ? (
        <div
          className="mt-2 max-h-[60vh] w-[230px] overflow-y-auto rounded-2xl bg-surface p-2.5 shadow-float ring-1 ring-border"
          data-testid="canvas-v2-components-panel"
        >
          <div className="mb-1.5 px-1 text-[10px] leading-snug text-muted-foreground">
            {t("workspace.canvas.chrome.components.hint")}
          </div>
          {groups.map((group) => (
            <div key={group.key} className="mb-2 last:mb-0">
              <div className="px-1 pb-1 text-[9.5px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                {t(`workspace.canvas.chrome.components.groups.${group.key}`)}
              </div>
              <div className="space-y-0.5">
                {group.entries.length === 0 ? (
                  <div className="px-2 py-1 text-[11px] text-muted-foreground/70">
                    {t("workspace.canvas.chrome.components.emptyGroup")}
                  </div>
                ) : (
                  group.entries.map((entry) => (
                    <button
                      key={entry.id}
                      draggable
                      className="flex w-full cursor-grab items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs ring-1 ring-transparent transition-colors hover:bg-accent/60 hover:ring-border"
                      data-testid={`canvas-v2-component-${entry.id}`}
                      type="button"
                      onClick={() => addEntry(entry.payload)}
                      onDragStart={(event) => handleDragStart(event, entry.payload)}
                    >
                      <span className="flex size-5 items-center justify-center rounded-md bg-surface-2">
                        <entry.icon className="size-3 text-foreground/70" />
                      </span>
                      <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                      <Plus className="size-3 text-muted-foreground/50" />
                    </button>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

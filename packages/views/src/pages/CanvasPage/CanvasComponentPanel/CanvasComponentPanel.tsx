import { Fragment, useEffect, useRef, useState, type DragEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useList } from "@refinedev/core";
import type { Operation, Skill } from "@repo/schemas";
import {
  Boxes,
  File,
  FolderGit2,
  FolderOpen,
  HardDrive,
  MessageSquare,
  Plus,
  Search,
  Sparkles,
  Workflow,
  X,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import type { XYPosition } from "@xyflow/system";
import { Input } from "@repo/ui/input";
import { cn } from "@repo/ui/lib/utils";
import { ResourceName } from "../../../constants";
import { useCanvasPageStore, type CanvasComponentCategory } from "../_store";
import {
  CANVAS_COMPONENT_DRAG_MIME,
  encodeCanvasComponentDragPayload,
  type CanvasComponentDragPayload,
} from "../utils/canvasComponentDragPayload";
import { getNodeMeta, getNodeTypeLabel, getNodeTypeShortLabel } from "../utils/nodeTypeMeta";

interface CanvasComponentPanelProps {
  getCreateNodeScreenPosition: () => XYPosition;
}

type PaletteObjectType =
  | "file"
  | "folder"
  | "github-project"
  | "prompt"
  | "output-local-path"
  | "output-project-path";

type PaletteEntry = {
  icon: LucideIcon;
  iconBg: string;
  id: string;
  label: string;
  payload: CanvasComponentDragPayload;
  shortLabel: string;
};

const INPUT_NODE_TYPES: PaletteObjectType[] = ["folder", "file", "github-project", "prompt"];
const OUTPUT_NODE_TYPES: PaletteObjectType[] = ["output-local-path", "output-project-path"];

const OBJECT_ICONS: Record<PaletteObjectType, LucideIcon> = {
  file: File,
  folder: FolderOpen,
  "github-project": FolderGit2,
  prompt: MessageSquare,
  "output-local-path": HardDrive,
  "output-project-path": Boxes,
};

const normalizeSearch = (value: string) => value.trim().toLowerCase();

const includesSearch = (values: Array<string | null | undefined>, query: string) =>
  values.some((value) => value?.toLowerCase().includes(query));

const isEditableElement = (element: Element | null) =>
  element instanceof HTMLInputElement ||
  element instanceof HTMLTextAreaElement ||
  element instanceof HTMLSelectElement ||
  (element instanceof HTMLElement && element.isContentEditable);

const createDragImage = ({
  iconBg,
  label,
  shortLabel,
}: {
  iconBg: string;
  label: string;
  shortLabel: string;
}) => {
  const image = document.createElement("div");
  image.className = "canvas-component-drag-image";

  const icon = document.createElement("span");
  icon.className = `canvas-component-drag-image__icon ${iconBg}`;

  const text = document.createElement("span");
  text.className = "canvas-component-drag-image__text";
  text.textContent = label;

  const meta = document.createElement("span");
  meta.className = "canvas-component-drag-image__meta";
  meta.textContent = shortLabel;

  image.append(icon, text, meta);
  document.body.append(image);

  return image;
};

export const CanvasComponentPanel = ({
  getCreateNodeScreenPosition,
}: CanvasComponentPanelProps) => {
  const { t } = useTranslation();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [draggingComponentId, setDraggingComponentId] = useState<string | null>(null);
  const [searchVisible, setSearchVisible] = useState(false);
  const store = useCanvasPageStore();
  const isSidebarOpen = useStore(store, (state) => state.isSidebarOpen);
  const sidebarPanel = useStore(store, (state) => state.sidebarPanel);
  const agentPanelIsOpen = useStore(store, (state) => state.agentPanel.isOpen);
  const handleToggleSidebar = useStore(store, (state) => state.handleToggleSidebar);
  const handleSidebarPanelChange = useStore(store, (state) => state.handleSidebarPanelChange);
  const componentSearchQuery = useStore(store, (state) => state.componentSearchQuery);
  const collapsedComponentCategories = useStore(
    store,
    (state) => state.collapsedComponentCategories,
  );
  const handleComponentSearchChange = useStore(store, (state) => state.handleComponentSearchChange);
  const setComponentSearchQuery = useStore(store, (state) => state.setComponentSearchQuery);
  const toggleComponentCategory = useStore(store, (state) => state.toggleComponentCategory);
  const handleCreateObjectNode = useStore(store, (state) => state.handleCreateObjectNode);
  const handleCreateOperationNode = useStore(store, (state) => state.handleCreateOperationNode);
  const handleCreateSkillOperationNode = useStore(
    store,
    (state) => state.handleCreateSkillOperationNode,
  );
  const { result: operationsResult } = useList<Operation>({
    resource: ResourceName.operations,
  });
  const { result: skillsResult } = useList<Skill>({
    resource: ResourceName.skills,
  });
  const operations = operationsResult.data;
  const skills = skillsResult.data;
  const search = normalizeSearch(componentSearchQuery);
  const componentSearchLabel = t("canvas.componentPanel.searchLabel", {
    defaultValue: "Search components",
  });
  const componentSearchPlaceholder = t("canvas.componentPanel.searchPlaceholder", {
    defaultValue: "Search components...",
  });
  const inputCategoryLabel = t("canvas.componentPanel.categories.input", {
    defaultValue: "Input Objects",
  });
  const operationsCategoryLabel = t("canvas.componentPanel.categories.operations", {
    defaultValue: "Operations",
  });
  const skillsCategoryLabel = t("canvas.componentPanel.categories.skills", {
    defaultValue: "Skills",
  });
  const outputCategoryLabel = t("canvas.componentPanel.categories.output", {
    defaultValue: "Output",
  });
  const operationShortLabel = t("canvas.nodeTypes.operation.shortLabel");
  const skillFallbackLabel = t("canvas.componentPanel.skillFallbackLabel", {
    defaultValue: "Skill",
  });
  const newCustomOperationLabel = t("canvas.componentPanel.newCustomOperation", {
    defaultValue: "New Custom Operation",
  });
  const compoundCategoryLabel = t("canvas.componentPanel.categories.compound", {
    defaultValue: "Compound",
  });
  const compoundEntry: PaletteEntry = {
    icon: Boxes,
    iconBg: "bg-surface-2",
    id: "object-compound",
    label: getNodeTypeLabel(t, "compound"),
    payload: { kind: "object", type: "compound" },
    shortLabel: getNodeTypeShortLabel(t, "compound"),
  };
  const panelOpen = isSidebarOpen && sidebarPanel === "components";
  const panelToggleLabel = panelOpen
    ? t("canvas.operationsPanel.collapse")
    : t("canvas.operationsPanel.expand");

  useEffect(() => {
    const handleSearchShortcut = (event: KeyboardEvent) => {
      if (
        event.key !== "/" ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.defaultPrevented
      ) {
        return;
      }

      const activeElement = document.activeElement;
      if (activeElement === searchInputRef.current || isEditableElement(activeElement)) {
        return;
      }

      event.preventDefault();
      setSearchVisible(true);
    };

    globalThis.addEventListener("keydown", handleSearchShortcut);

    return () => {
      globalThis.removeEventListener("keydown", handleSearchShortcut);
    };
  }, []);

  useEffect(() => {
    if (searchVisible) {
      searchInputRef.current?.focus();
    }
  }, [searchVisible]);

  const handleCategoryHeaderClick = (category: CanvasComponentCategory) => () => {
    toggleComponentCategory(category);
  };

  const handleEntryClick = (payload: CanvasComponentDragPayload) => () => {
    const position = getCreateNodeScreenPosition();

    if (payload.kind === "object") {
      handleCreateObjectNode(payload.type, position);
    } else if (payload.kind === "operation") {
      handleCreateOperationNode(payload.operation, position);
    } else {
      void handleCreateSkillOperationNode(payload.skill, position);
    }
  };

  const handleComponentDragStart =
    ({
      dragId,
      iconBg,
      label,
      payload,
      shortLabel,
    }: {
      dragId: string;
      iconBg: string;
      label: string;
      payload: CanvasComponentDragPayload;
      shortLabel: string;
    }) =>
    (event: DragEvent<HTMLButtonElement>) => {
      event.dataTransfer.effectAllowed = "copy";
      event.dataTransfer.setData(
        CANVAS_COMPONENT_DRAG_MIME,
        encodeCanvasComponentDragPayload(payload),
      );
      event.dataTransfer.setData("text/plain", label);

      const dragImage = createDragImage({ iconBg, label, shortLabel });
      event.dataTransfer.setDragImage(dragImage, 24, 24);
      setTimeout(() => dragImage.remove(), 0);
      setDraggingComponentId(dragId);
    };

  const handleComponentDragEnd = () => {
    setDraggingComponentId(null);
  };
  const handleSearchClose = () => {
    setComponentSearchQuery("");
    setSearchVisible(false);
  };
  const handlePanelToggle = () => {
    if (panelOpen) {
      handleToggleSidebar();

      return;
    }
    handleSidebarPanelChange("components");
    if (!isSidebarOpen) {
      handleToggleSidebar();
    }
  };

  const createObjectEntry = (type: PaletteObjectType): PaletteEntry => {
    const meta = getNodeMeta(type);
    const label = getNodeTypeLabel(t, type);

    return {
      icon: OBJECT_ICONS[type],
      iconBg: meta?.iconBg ?? "bg-surface-2",
      id: `object-${type}`,
      label,
      payload: { kind: "object", type },
      shortLabel: getNodeTypeShortLabel(t, type),
    };
  };

  const objectItems: PaletteEntry[] = INPUT_NODE_TYPES.filter((type) => {
    const meta = getNodeMeta(type);
    const label = getNodeTypeLabel(t, type);
    const shortLabel = getNodeTypeShortLabel(t, type);

    return search === "" || includesSearch([label, shortLabel, meta?.label, type], search);
  }).map(createObjectEntry);

  const outputItems: PaletteEntry[] = OUTPUT_NODE_TYPES.filter((type) => {
    const meta = getNodeMeta(type);
    const label = getNodeTypeLabel(t, type);
    const shortLabel = getNodeTypeShortLabel(t, type);

    return search === "" || includesSearch([label, shortLabel, meta?.label, type], search);
  }).map(createObjectEntry);

  const operationItems: PaletteEntry[] = operations
    .filter((operation) =>
      search === ""
        ? true
        : includesSearch([operation.name, operation.description, "operation"], search),
    )
    .map((operation) => ({
      icon: Workflow,
      iconBg: "bg-violet-500",
      id: `operation-${operation.id}`,
      label: operation.name,
      payload: { kind: "operation", operation },
      shortLabel: operationShortLabel,
    }));

  const skillItems: PaletteEntry[] = skills
    .filter((skill) =>
      search === ""
        ? true
        : includesSearch([skill.name, skill.label, skill.description, ...skill.tags], search),
    )
    .map((skill) => ({
      icon: Sparkles,
      iconBg: "bg-amber-500",
      id: `skill-${skill.id}`,
      label: skill.label,
      payload: { kind: "skill", skill },
      shortLabel: skill.tags[0] ?? skillFallbackLabel,
    }));

  const compoundItems: PaletteEntry[] =
    search === "" ||
    includesSearch([compoundEntry.label, compoundEntry.shortLabel, "compound"], search)
      ? [compoundEntry]
      : [];

  const groups: ReadonlyArray<{
    category: CanvasComponentCategory;
    entries: PaletteEntry[];
    label: string;
  }> = [
    { category: "input", entries: objectItems, label: inputCategoryLabel },
    { category: "operations", entries: operationItems, label: operationsCategoryLabel },
    { category: "skills", entries: skillItems, label: skillsCategoryLabel },
    { category: "output", entries: outputItems, label: outputCategoryLabel },
  ];

  const renderCategoryHeader = (category: CanvasComponentCategory, label: string) => {
    const collapsed = collapsedComponentCategories[category];

    return (
      <button
        aria-expanded={!collapsed}
        aria-label={t("canvas.componentPanel.categoryAriaLabel", {
          label,
          defaultValue: "{{label}} category",
        })}
        className="px-1 pb-1 text-[9.5px] font-medium uppercase tracking-[0.1em] text-muted-foreground"
        type="button"
        onClick={handleCategoryHeaderClick(category)}
      >
        {label}
      </button>
    );
  };

  const renderEntry = (entry: PaletteEntry) => (
    <button
      key={entry.id}
      draggable
      className={cn(
        "flex w-full cursor-grab items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs ring-1 ring-transparent transition-colors hover:bg-accent/60 hover:ring-border",
        draggingComponentId === entry.id && "scale-[0.98] opacity-60",
      )}
      data-testid={
        entry.payload.kind === "operation"
          ? `canvas-operation-${entry.payload.operation.id}`
          : entry.payload.kind === "skill"
            ? `canvas-skill-${entry.payload.skill.id}`
            : `canvas-component-${entry.id}`
      }
      type="button"
      onClick={handleEntryClick(entry.payload)}
      onDragEnd={handleComponentDragEnd}
      onDragStart={handleComponentDragStart({
        dragId: entry.id,
        iconBg: entry.iconBg,
        label: entry.label,
        payload: entry.payload,
        shortLabel: entry.shortLabel,
      })}
    >
      <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-surface-2">
        <entry.icon className="size-3 text-foreground/70" />
      </span>
      <span className="min-w-0 flex-1 truncate">{entry.label}</span>
      <Plus className="size-3 text-muted-foreground/50" />
    </button>
  );

  return (
    <div
      className={cn(
        "pointer-events-auto absolute left-3 top-16 z-10",
        agentPanelIsOpen && "max-[1180px]:hidden",
      )}
      data-testid="canvas-component-panel-root"
    >
      <button
        aria-label={panelToggleLabel}
        aria-pressed={panelOpen}
        className={cn(
          "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs shadow-pill ring-1 transition-colors",
          panelOpen
            ? "bg-foreground text-background ring-foreground"
            : "bg-surface ring-border hover:ring-border-strong",
        )}
        data-testid="canvas-component-panel-toggle"
        type="button"
        onClick={handlePanelToggle}
      >
        <Boxes className="size-3.5" />
        {t("nav.items.components")}
      </button>

      {panelOpen ? (
        <div
          className="mt-2 max-h-[60vh] w-[230px] overflow-y-auto rounded-2xl bg-surface p-2.5 shadow-float ring-1 ring-border"
          data-testid="canvas-component-panel"
        >
          <div className="mb-1.5 px-1 text-[10px] leading-snug text-muted-foreground">
            {t("canvas.componentPanel.hint", {
              defaultValue: "Click to place in the canvas center, or drag it in.",
            })}
          </div>

          {searchVisible && (
            <div className="mb-2 flex h-8 items-center gap-1.5 rounded-lg bg-surface-2 px-2 ring-1 ring-border">
              <Search className="size-3 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                aria-label={componentSearchLabel}
                className="h-7 min-w-0 border-none bg-transparent px-0 text-xs shadow-none focus-visible:ring-0"
                name="canvasComponentSearch"
                placeholder={componentSearchPlaceholder}
                value={componentSearchQuery}
                onChange={handleComponentSearchChange}
              />
              <button
                aria-label={t("common.clearSearch")}
                className="flex size-6 shrink-0 items-center justify-center rounded-full hover:bg-accent/60"
                type="button"
                onClick={handleSearchClose}
              >
                <X className="size-3" />
              </button>
            </div>
          )}

          <div className="pr-0.5">
            {groups.map((group) => (
              <Fragment key={group.category}>
                <div className="mb-2 last:mb-0">
                  {renderCategoryHeader(group.category, group.label)}
                  {!collapsedComponentCategories[group.category] && (
                    <div className="space-y-0.5">
                      {group.entries.length === 0 ? (
                        <div className="px-2 py-1 text-[11px] text-muted-foreground">
                          {t("canvas.componentPanel.emptyGroup", {
                            defaultValue: "No components",
                          })}
                        </div>
                      ) : (
                        group.entries.map(renderEntry)
                      )}
                    </div>
                  )}
                </div>
                {group.category === "operations" && (
                  <div className="mb-2 last:mb-0">
                    <div
                      className="px-1 pb-1 text-[9.5px] font-medium uppercase tracking-[0.1em] text-muted-foreground"
                      data-testid="canvas-component-category-compound"
                    >
                      {compoundCategoryLabel}
                    </div>
                    <div className="space-y-0.5">
                      {compoundItems.length === 0 ? (
                        <div className="px-2 py-1 text-[11px] text-muted-foreground">
                          {t("canvas.componentPanel.emptyGroup", {
                            defaultValue: "No components",
                          })}
                        </div>
                      ) : (
                        compoundItems.map(renderEntry)
                      )}
                    </div>
                  </div>
                )}
              </Fragment>
            ))}
          </div>

          <Link
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-foreground/80 ring-1 ring-transparent transition-colors hover:bg-accent/60 hover:ring-border"
            to="/pipelines/operations/new"
          >
            <Plus className="size-3" />
            {newCustomOperationLabel}
          </Link>
        </div>
      ) : null}
    </div>
  );
};

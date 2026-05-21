import { useEffect, useRef, type ElementType } from "react";
import { Link } from "@tanstack/react-router";
import { useList } from "@refinedev/core";
import type { BuiltinNodeType, Operation, Skill } from "@repo/schemas";
import {
  ChevronDown,
  ChevronRight,
  FileCode,
  Folder,
  FolderOutput,
  HardDrive,
  MessageSquareText,
  Plus,
  Search,
  Sparkles,
  Zap,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import type { XYPosition } from "@xyflow/system";
import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { cn } from "@repo/ui/lib/utils";
import { SiGitHubIcon } from "@/components/icons/SiGitHubIcon";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { useCanvasPageStore, type CanvasComponentCategory } from "../_store";
import { getNodeMeta, getNodeTypeLabel, getNodeTypeShortLabel } from "../utils/nodeTypeMeta";

interface CanvasComponentPanelProps {
  getCreateNodeScreenPosition: () => XYPosition;
}

const INPUT_NODE_TYPES: BuiltinNodeType[] = ["folder", "file", "github-project", "prompt"];
const OUTPUT_NODE_TYPES: BuiltinNodeType[] = ["output-local-path", "output-project-path"];

const TYPE_ICONS: Record<string, ElementType> = {
  file: FileCode,
  folder: Folder,
  "github-project": SiGitHubIcon,
  prompt: MessageSquareText,
  "output-project-path": FolderOutput,
  "output-local-path": HardDrive,
};

const normalizeSearch = (value: string) => value.trim().toLowerCase();

const includesSearch = (values: Array<string | null | undefined>, query: string) =>
  values.some((value) => value?.toLowerCase().includes(query));

const shouldHandleSlashShortcut = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return true;

  return !["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) && !target.isContentEditable;
};

export const CanvasComponentPanel = ({
  getCreateNodeScreenPosition,
}: CanvasComponentPanelProps) => {
  const { t } = useTranslation();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const store = useCanvasPageStore();
  const componentSearchQuery = useStore(store, (state) => state.componentSearchQuery);
  const collapsedComponentCategories = useStore(
    store,
    (state) => state.collapsedComponentCategories,
  );
  const handleComponentSearchChange = useStore(store, (state) => state.handleComponentSearchChange);
  const toggleComponentCategory = useStore(store, (state) => state.toggleComponentCategory);
  const handleCreateObjectNode = useStore(store, (state) => state.handleCreateObjectNode);
  const handleCreateOperationNode = useStore(store, (state) => state.handleCreateOperationNode);
  const handleCreateSkillOperationNode = useStore(
    store,
    (state) => state.handleCreateSkillOperationNode,
  );
  const { result: operationsResult } = useList<Operation>({ resource: ResourceName.operations });
  const { result: skillsResult } = useList<Skill>({ resource: ResourceName.skills });
  const operations = operationsResult.data;
  const skills = skillsResult.data;
  const search = normalizeSearch(componentSearchQuery);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || !shouldHandleSlashShortcut(event.target)) return;
      event.preventDefault();
      searchInputRef.current?.focus();
    };

    globalThis.addEventListener("keydown", handleKeyDown);

    return () => globalThis.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleCategoryHeaderClick = (category: CanvasComponentCategory) => () => {
    toggleComponentCategory(category);
  };

  const handleNodeTypeItemClick = (type: BuiltinNodeType) => () => {
    handleCreateObjectNode(type, getCreateNodeScreenPosition());
  };

  const handleOperationItemClick = (operation: Operation) => () => {
    handleCreateOperationNode(operation, getCreateNodeScreenPosition());
  };

  const handleSkillItemClick = (skill: Skill) => () => {
    void handleCreateSkillOperationNode(skill, getCreateNodeScreenPosition());
  };

  const objectItems = INPUT_NODE_TYPES.filter((type) => {
    const meta = getNodeMeta(type);
    const label = getNodeTypeLabel(t, type);
    const shortLabel = getNodeTypeShortLabel(t, type);

    return search === "" || includesSearch([label, shortLabel, meta?.label, type], search);
  });

  const outputItems = OUTPUT_NODE_TYPES.filter((type) => {
    const meta = getNodeMeta(type);
    const label = getNodeTypeLabel(t, type);
    const shortLabel = getNodeTypeShortLabel(t, type);

    return search === "" || includesSearch([label, shortLabel, meta?.label, type], search);
  });

  const operationItems = operations.filter((operation) =>
    search === ""
      ? true
      : includesSearch([operation.name, operation.description, "operation"], search),
  );

  const skillItems = skills.filter((skill) =>
    search === ""
      ? true
      : includesSearch([skill.name, skill.label, skill.description, ...skill.tags], search),
  );

  const renderCategoryHeader = (
    category: CanvasComponentCategory,
    label: string,
    count: number,
  ) => {
    const collapsed = collapsedComponentCategories[category];
    const ChevronIcon = collapsed ? ChevronRight : ChevronDown;

    return (
      <Button
        aria-expanded={!collapsed}
        aria-label={`${label} category`}
        className="h-9 w-full justify-start gap-2 rounded-none border-t px-5 text-sm font-semibold"
        type="button"
        variant="ghost"
        onClick={handleCategoryHeaderClick(category)}
      >
        <ChevronIcon className="size-3.5" />
        <span className="flex-1 text-left">{label}</span>
        <span className="text-xs text-muted-foreground">{count}</span>
      </Button>
    );
  };

  const renderNodeTypeItem = (type: BuiltinNodeType) => {
    const Icon = TYPE_ICONS[type];
    const meta = getNodeMeta(type);
    const label = getNodeTypeLabel(t, type);
    const shortLabel = getNodeTypeShortLabel(t, type);
    if (!meta) return null;

    return (
      <Button
        key={type}
        className="h-10 w-full justify-start gap-2 rounded-md px-2 text-left"
        type="button"
        variant="ghost"
        onClick={handleNodeTypeItemClick(type)}
      >
        <span
          className={cn("flex size-6 shrink-0 items-center justify-center rounded", meta.iconBg)}
        >
          <Icon className="size-3.5 text-white" />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{shortLabel}</span>
        <Plus className="size-3 text-muted-foreground" />
      </Button>
    );
  };

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-background"
      data-testid="canvas-component-panel"
    >
      <div className="border-b p-4">
        <div className="flex h-10 items-center gap-2 rounded-md border bg-muted/30 px-3">
          <Search className="size-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            aria-label="Search components"
            className="h-8 border-none bg-transparent px-0 shadow-none focus-visible:ring-0"
            name="canvasComponentSearch"
            placeholder="Search components..."
            value={componentSearchQuery}
            onChange={handleComponentSearchChange}
          />
          <kbd className="rounded border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
            /
          </kbd>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {renderCategoryHeader("input", "Input Objects", objectItems.length)}
        {!collapsedComponentCategories.input && (
          <div className="space-y-1 p-3">{objectItems.map(renderNodeTypeItem)}</div>
        )}

        {renderCategoryHeader("operations", "Operations", operationItems.length)}
        {!collapsedComponentCategories.operations && (
          <div className="space-y-1 p-3">
            {operationItems.map((operation) => (
              <Button
                key={operation.id}
                className="h-10 w-full justify-start gap-2 rounded-md px-2 text-left"
                type="button"
                variant="ghost"
                onClick={handleOperationItemClick(operation)}
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded bg-violet-500">
                  <Zap className="size-3.5 text-white" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {operation.name}
                </span>
                <Plus className="size-3 text-muted-foreground" />
              </Button>
            ))}
          </div>
        )}

        {renderCategoryHeader("skills", "Skills", skillItems.length)}
        {!collapsedComponentCategories.skills && (
          <div className="space-y-1 p-3">
            {skillItems.map((skill) => (
              <Button
                key={skill.id}
                className="h-auto min-h-10 w-full justify-start gap-2 rounded-md px-2 py-2 text-left"
                type="button"
                variant="ghost"
                onClick={handleSkillItemClick(skill)}
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded bg-amber-500">
                  <Sparkles className="size-3.5 text-white" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{skill.label}</span>
                {skill.tags.slice(0, 1).map((tag) => (
                  <Badge key={tag} className="shrink-0 text-[10px]" variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </Button>
            ))}
          </div>
        )}

        {renderCategoryHeader("output", "Output", outputItems.length)}
        {!collapsedComponentCategories.output && (
          <div className="space-y-1 p-3">{outputItems.map(renderNodeTypeItem)}</div>
        )}
      </div>

      <div className="border-t p-3">
        <Link
          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border bg-background px-3 text-sm font-medium hover:bg-muted"
          to="/pipelines/operations/new"
        >
          <Plus className="size-4" />
          New Custom Operation
        </Link>
      </div>
    </div>
  );
};

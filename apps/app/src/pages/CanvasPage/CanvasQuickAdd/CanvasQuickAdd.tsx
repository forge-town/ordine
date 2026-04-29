import { useState, type ElementType } from "react";
import { useTranslation } from "react-i18next";
import { useList } from "@refinedev/core";
import type { Operation, Recipe } from "@repo/schemas";
import type { BuiltinNodeType } from "@repo/pipeline-engine/schemas";
import { BookOpen, FileCode, Folder, FolderOutput, HardDrive, Search, Zap, X } from "lucide-react";
import { useStore } from "zustand";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { cn } from "@repo/ui/lib/utils";
import { SiGitHubIcon } from "@/components/icons/SiGitHubIcon";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { useHarnessCanvasStore } from "../_store";
import { getNodeMeta } from "../utils/nodeTypeMeta";
import type { XYPosition } from "@xyflow/system";

const QUICK_ADD_OBJECT_TYPES: BuiltinNodeType[] = ["code-file", "folder", "github-project"];

const TYPE_ICONS: Record<string, ElementType> = {
  "code-file": FileCode,
  folder: Folder,
  "github-project": SiGitHubIcon,
  "output-project-path": FolderOutput,
  "output-local-path": HardDrive,
};

const normalizeSearch = (value: string) => value.trim().toLowerCase();

const includesSearch = (values: Array<string | null | undefined>, query: string) =>
  values.some((value) => value?.toLowerCase().includes(query));

interface CanvasNodeCreationPaletteProps {
  getCreateNodeScreenPosition: () => XYPosition;
}

export const CanvasNodeCreationPalette = ({
  getCreateNodeScreenPosition,
}: CanvasNodeCreationPaletteProps) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const store = useHarnessCanvasStore();
  const isOpen = useStore(store, (state) => state.isQuickAddOpen);
  const closeQuickAdd = useStore(store, (state) => state.closeQuickAdd);
  const createObjectNodeAtScreenPosition = useStore(
    store,
    (state) => state.createObjectNodeAtScreenPosition
  );
  const createOperationNodeAtScreenPosition = useStore(
    store,
    (state) => state.createOperationNodeAtScreenPosition
  );
  const createRecipeNodeAtScreenPosition = useStore(
    store,
    (state) => state.createRecipeNodeAtScreenPosition
  );

  const { result: operationsResult } = useList<Operation>({
    resource: ResourceName.operations,
  });
  const { result: recipesResult } = useList<Recipe>({ resource: ResourceName.recipes });

  const operations = operationsResult?.data ?? [];
  const recipes = recipesResult?.data ?? [];
  const search = normalizeSearch(query);

  const objectItems = QUICK_ADD_OBJECT_TYPES.filter((type) => {
    const meta = getNodeMeta(type);

    return search === "" || includesSearch([meta?.label, meta?.shortLabel, type], search);
  });

  const operationItems = operations.filter((operation) =>
    search === ""
      ? true
      : includesSearch([operation.name, operation.description, "operation"], search)
  );

  const recipeItems = recipes
    .map((recipe) => ({
      recipe,
      operation: operations.find((operation) => operation.id === recipe.operationId),
    }))
    .filter(
      (item): item is { recipe: Recipe; operation: Operation } => item.operation !== undefined
    )
    .filter(({ recipe, operation }) =>
      search === ""
        ? true
        : includesSearch([recipe.name, recipe.description, operation.name, "recipe"], search)
    );

  const hasResults = objectItems.length > 0 || operationItems.length > 0 || recipeItems.length > 0;

  const handleClose = () => {
    setQuery("");
    closeQuickAdd();
  };

  const handleQueryChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      handleClose();
    }
  };

  const handleCreateObjectNode = (type: BuiltinNodeType) => {
    createObjectNodeAtScreenPosition(type, getCreateNodeScreenPosition());
    setQuery("");
  };

  const handleCreateOperationNode = (operation: Operation) => {
    createOperationNodeAtScreenPosition(operation, getCreateNodeScreenPosition());
    setQuery("");
  };

  const handleCreateRecipeNode = (recipe: Recipe, operation: Operation) => {
    createRecipeNodeAtScreenPosition(recipe, operation, getCreateNodeScreenPosition());
    setQuery("");
  };

  if (!isOpen) return null;

  return (
    <div
      aria-label={t("canvas.quickAdd.title")}
      className="absolute left-1/2 top-14 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-border bg-background shadow-lg"
      role="dialog"
    >
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <Input
          autoFocus
          aria-label={t("canvas.quickAdd.searchPlaceholder")}
          className="h-8 border-none bg-transparent px-0 shadow-none focus-visible:ring-0"
          name="canvasQuickAddSearch"
          placeholder={t("canvas.quickAdd.searchPlaceholder")}
          value={query}
          onChange={handleQueryChange}
          onKeyDown={handleSearchKeyDown}
        />
        <Button
          aria-label={t("canvas.quickAdd.close")}
          className="size-7"
          size="icon"
          title={t("canvas.quickAdd.close")}
          variant="ghost"
          onClick={handleClose}
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="max-h-[calc(100vh-8rem)] overflow-y-auto overscroll-contain md:max-h-[22rem]">
        <div className="space-y-3 p-2">
          {objectItems.length > 0 && (
            <section>
              <div className="px-2 py-1 text-[11px] font-semibold uppercase text-muted-foreground">
                {t("canvas.quickAdd.objects")}
              </div>
              <div className="space-y-0.5">
                {objectItems.map((type) => {
                  const Icon = TYPE_ICONS[type];
                  const meta = getNodeMeta(type)!;

                  return (
                    <button
                      key={type}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      type="button"
                      onClick={() => handleCreateObjectNode(type)}
                    >
                      <span
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded",
                          meta.iconBg
                        )}
                      >
                        <Icon className="size-3.5 text-white" />
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium">{meta.label}</span>
                      <span className="text-xs text-muted-foreground">{meta.shortLabel}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {operationItems.length > 0 && (
            <section>
              <div className="px-2 py-1 text-[11px] font-semibold uppercase text-muted-foreground">
                {t("canvas.quickAdd.operations")}
              </div>
              <div className="space-y-0.5">
                {operationItems.map((operation) => (
                  <button
                    key={operation.id}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    type="button"
                    onClick={() => handleCreateOperationNode(operation)}
                  >
                    <span className="flex size-6 shrink-0 items-center justify-center rounded bg-violet-500">
                      <Zap className="size-3.5 text-white" />
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">{operation.name}</span>
                    <span className="text-xs text-muted-foreground">OP</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {recipeItems.length > 0 && (
            <section>
              <div className="px-2 py-1 text-[11px] font-semibold uppercase text-muted-foreground">
                {t("canvas.quickAdd.recipes")}
              </div>
              <div className="space-y-0.5">
                {recipeItems.map(({ recipe, operation }) => (
                  <button
                    key={recipe.id}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    type="button"
                    onClick={() => handleCreateRecipeNode(recipe, operation)}
                  >
                    <span className="flex size-6 shrink-0 items-center justify-center rounded bg-amber-500">
                      <BookOpen className="size-3.5 text-white" />
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">{recipe.name}</span>
                    <span className="max-w-28 truncate text-xs text-muted-foreground">
                      {operation.name}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {!hasResults && (
            <div className="px-2 py-8 text-center text-sm text-muted-foreground">
              {t("canvas.quickAdd.noResults")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

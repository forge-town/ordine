import type { ElementType } from "react";
import { useTranslation } from "react-i18next";
import { useList } from "@refinedev/core";
import type { Operation, BuiltinNodeType } from "@repo/schemas";
import {
  FileCode,
  Folder,
  FolderOutput,
  HardDrive,
  MessageSquareText,
  Search,
  Zap,
  X,
} from "lucide-react";
import { useStore } from "zustand";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { cn } from "@repo/ui/lib/utils";
import { SiGitHubIcon } from "@/components/icons/SiGitHubIcon";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { useCanvasPageStore } from "../_store";
import { getNodeMeta, getNodeTypeLabel, getNodeTypeShortLabel } from "../utils/nodeTypeMeta";
import type { XYPosition } from "@xyflow/system";

const QUICK_ADD_OBJECT_TYPES: BuiltinNodeType[] = ["file", "folder", "github-project", "prompt"];

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

interface CanvasNodeCreationPaletteProps {
  getCreateNodeScreenPosition: () => XYPosition;
}

export const CanvasNodeCreationPalette = ({
  getCreateNodeScreenPosition,
}: CanvasNodeCreationPaletteProps) => {
  const { t } = useTranslation();
  const store = useCanvasPageStore();
  const query = useStore(store, (state) => state.quickAddQuery);
  const handleQuickAddInputChange = useStore(store, (state) => state.handleQuickAddInputChange);
  const handleCloseQuickAdd = useStore(store, (state) => state.handleCloseQuickAdd);
  const handleQuickAddKeyDown = useStore(store, (state) => state.handleQuickAddKeyDown);
  const handleCreateObjectNode = useStore(store, (state) => state.handleCreateObjectNode);
  const handleCreateOperationNode = useStore(store, (state) => state.handleCreateOperationNode);

  const { result: operationsResult } = useList<Operation>({
    resource: ResourceName.operations,
  });
  const operations = operationsResult.data;
  const search = normalizeSearch(query);

  const objectItems = QUICK_ADD_OBJECT_TYPES.filter((type) => {
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

  const hasResults = objectItems.length > 0 || operationItems.length > 0;

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
          onChange={handleQuickAddInputChange}
          onKeyDown={handleQuickAddKeyDown}
        />
        <Button
          aria-label={t("canvas.quickAdd.close")}
          className="size-7"
          size="icon"
          title={t("canvas.quickAdd.close")}
          variant="ghost"
          onClick={handleCloseQuickAdd}
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
                  const meta = getNodeMeta(type);
                  const label = getNodeTypeLabel(t, type);
                  const shortLabel = getNodeTypeShortLabel(t, type);
                  if (!meta) return null;

                  return (
                    <Button
                      key={type}
                      className="flex h-auto w-full items-center justify-start gap-2 px-2 py-2 text-left text-sm font-normal"
                      type="button"
                      variant="ghost"
                      onClick={() => handleCreateObjectNode(type, getCreateNodeScreenPosition())}
                    >
                      <span
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded",
                          meta.iconBg,
                        )}
                      >
                        <Icon className="size-3.5 text-white" />
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
                      <span className="text-xs text-muted-foreground">{shortLabel}</span>
                    </Button>
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
                  <Button
                    key={operation.id}
                    className="flex h-auto w-full items-center justify-start gap-2 px-2 py-2 text-left text-sm font-normal"
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      handleCreateOperationNode(operation, getCreateNodeScreenPosition())
                    }
                  >
                    <span className="flex size-6 shrink-0 items-center justify-center rounded bg-violet-500">
                      <Zap className="size-3.5 text-white" />
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">{operation.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {t("canvas.nodeTypes.operation.shortLabel")}
                    </span>
                  </Button>
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

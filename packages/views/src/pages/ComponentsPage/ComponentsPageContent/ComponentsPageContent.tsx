import { useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useDataProvider, useDelete, useList } from "@refinedev/core";
import { useTranslation } from "react-i18next";
import { ResultAsync } from "neverthrow";
import { Boxes, Cpu, Download, Plus, Search, Upload, Workflow } from "lucide-react";
import { Button } from "@repo/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/dropdown-menu";
import type { Operation, PipelineAsset } from "@repo/schemas";
import { PageHeader } from "../../../components/PageHeader";
import { PageLoadingState } from "../../../components/PageLoadingState";
import { Chip, Icon, SearchInput } from "../../../components/primitives";
import { ResourceName } from "../../../constants";
import { ComponentCard, type ComponentCardItem, type ComponentCategory } from "../ComponentCard";
import { ComponentEditor } from "../ComponentEditor";
import { DeleteComponentDialog } from "../DeleteComponentDialog";
import { FindForMeModal } from "../FindForMeModal";
import { createBuiltinItems, toAssetItem, toOperationItem } from "../componentItems";

const CATEGORY_ICONS = {
  input: Download,
  operation: Cpu,
  output: Upload,
  "pipeline-skill": Workflow,
} satisfies Record<ComponentCategory, typeof Boxes>;

const CATEGORIES = ["all", "input", "operation", "output", "pipeline-skill"] as const;
const COMPONENT_CATEGORIES = ["input", "operation", "output", "pipeline-skill"] as const;
type ActiveCategory = (typeof CATEGORIES)[number];

export const ComponentsPageContent = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const getDataProvider = useDataProvider();
  const [active, setActive] = useState<ActiveCategory>("all");
  const [search, setSearch] = useState("");
  const [editingItem, setEditingItem] = useState<ComponentCardItem | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ComponentCardItem | null>(null);
  const [deleteUsageCount, setDeleteUsageCount] = useState<number | null>(null);
  const deleteUsageRequestId = useRef(0);
  const [findOpen, setFindOpen] = useState(false);
  const { result: assetsResult, query: assetsQuery } = useList<PipelineAsset>({
    resource: ResourceName.pipelineAssets,
    queryOptions: { retry: false },
  });
  const { result: operationsResult, query: operationsQuery } = useList<Operation>({
    resource: ResourceName.operations,
    queryOptions: { retry: false },
  });
  const { mutateAsync: deleteResource } = useDelete();
  const assets = assetsResult.data;
  const operations = operationsResult.data;
  const items = useMemo(
    () => [
      ...createBuiltinItems(t),
      ...operations.map((operation) => toOperationItem(operation, t)),
      ...assets.map((asset) => toAssetItem(asset, t)),
    ],
    [assets, operations, t],
  );
  const filteredItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();

    return items.filter((item) => {
      const matchesCategory = active === "all" || item.category === active;
      const matchesSearch =
        !query ||
        item.name.toLocaleLowerCase().includes(query) ||
        item.meta.toLocaleLowerCase().includes(query) ||
        item.description.toLocaleLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [active, items, search]);
  const counts = useMemo(
    () =>
      Object.fromEntries(
        CATEGORIES.map((category) => [
          category,
          category === "all"
            ? items.length
            : items.filter((item) => item.category === category).length,
        ]),
      ) as Record<ActiveCategory, number>,
    [items],
  );
  const visibleCategories: readonly ComponentCategory[] =
    active === "all" ? COMPONENT_CATEGORIES : [active];
  const sections = visibleCategories.map((category) => ({
    category,
    items: filteredItems.filter((item) => item.category === category),
  }));
  const editingAsset =
    editingItem?.source === "asset"
      ? assets.find((asset) => asset.id === editingItem.id)
      : undefined;
  const handleFindClick = () => setFindOpen(true);
  const handleNewOperationClick = () => void navigate({ to: "/pipelines/operations/new" });
  const handleDistillSkillClick = () => void navigate({ to: "/distillations" });
  const handleCategoryClick = (category: ActiveCategory) => () => setActive(category);
  const handleSearchChange = (value: string) => setSearch(value);
  const handleSearchClear = () => setSearch("");
  const handleEditorOpenChange = (open: boolean) => {
    if (!open) setEditingItem(null);
  };
  const handleDeleteConfirm = () => void handleConfirmDelete();
  const handleDeleteOpenChange = (open: boolean) => {
    if (!open) {
      deleteUsageRequestId.current += 1;
      setPendingDelete(null);
      setDeleteUsageCount(null);
    }
  };
  const handleFindOpenChange = (open: boolean) => setFindOpen(open);

  const handleEdit = (item: ComponentCardItem) => {
    if (item.source === "operation") {
      void navigate({
        params: { operationId: item.id },
        to: "/pipelines/operations/$operationId/edit",
      });

      return;
    }
    if (item.source === "asset") setEditingItem(item);
  };
  const handleDelete = (item: ComponentCardItem) => {
    const requestId = ++deleteUsageRequestId.current;
    setPendingDelete(item);
    setDeleteUsageCount(null);
    if (item.source !== "asset") return;

    const dataProvider = getDataProvider();
    void ResultAsync.fromPromise(
      dataProvider.custom!<{ count: number }>({
        url: "pipelineAssets/getUsageCount",
        method: "get",
        payload: { id: item.id },
      }),
      () => "usage-count-failed" as const,
    ).then((result) => {
      if (result.isOk() && requestId === deleteUsageRequestId.current) {
        setDeleteUsageCount(result.value.data.count);
      }
    });
  };
  const handleConfirmDelete = async () => {
    if (!pendingDelete || pendingDelete.source === "builtin") return;

    const resource =
      pendingDelete.source === "asset" ? ResourceName.pipelineAssets : ResourceName.operations;
    const result = await ResultAsync.fromPromise(
      deleteResource({ resource, id: pendingDelete.id }),
      () => "delete-failed" as const,
    );
    if (result.isErr()) return;

    setPendingDelete(null);
    if (resource === ResourceName.pipelineAssets) {
      await assetsQuery?.refetch?.();
    } else {
      await operationsQuery?.refetch?.();
    }
  };

  if (assetsQuery?.isLoading || operationsQuery?.isLoading) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <PageHeader
          eyebrow={t("nav.groups.assembly")}
          icon={<Icon className="text-muted-foreground" icon={Boxes} size={18} />}
          sub={t("components.subtitle")}
          title={t("components.title")}
        />
        <PageLoadingState variant="grid" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        actions={
          <>
            <Button size="sm" variant="ghost" onClick={handleFindClick}>
              <Search className="h-3.5 w-3.5" />
              {t("components.findForMe.title")}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button size="sm" />}>
                <Plus className="h-3.5 w-3.5" />
                {t("components.newComponent")}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={handleNewOperationClick}>
                  <Cpu className="h-4 w-4" />
                  {t("components.newOperation")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDistillSkillClick}>
                  <Workflow className="h-4 w-4" />
                  {t("components.distillSkill")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
        eyebrow={t("nav.groups.assembly")}
        icon={<Icon className="text-muted-foreground" icon={Boxes} size={18} />}
        sub={t("components.subtitle")}
        title={t("components.title")}
      />

      <div
        className="flex shrink-0 flex-col gap-2 px-4 pb-3.5 sm:flex-row sm:items-center sm:px-7"
        data-testid="components-toolbar"
      >
        <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto pb-1 sm:pb-0">
          {CATEGORIES.map((category) => (
            <Chip
              key={category}
              active={active === category}
              className="shrink-0"
              count={counts[category]}
              onClick={handleCategoryClick(category)}
            >
              {t(`components.categories.${category}`)}
            </Chip>
          ))}
        </div>
        <SearchInput
          className="w-full sm:ml-auto sm:w-60"
          clearLabel={t("common.clearSearch")}
          label={t("components.searchLabel")}
          placeholder={t("components.searchPlaceholder")}
          value={search}
          onChange={handleSearchChange}
          onClear={handleSearchClear}
        />
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 pb-8 sm:px-7">
        {sections.map(({ category, items: sectionItems }) =>
          sectionItems.length > 0 ? (
            <section key={category} aria-labelledby={`component-section-${category}`}>
              <div
                className="mb-2.5 flex items-center gap-2 text-[11px] font-semibold uppercase text-muted-foreground"
                id={`component-section-${category}`}
              >
                <Icon icon={CATEGORY_ICONS[category]} size={13} />
                {t(`components.categories.${category}`)}
                <span className="rounded-full bg-muted px-1.5 text-[10px] tabular-nums">
                  {sectionItems.length}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-3">
                {sectionItems.map((item) => (
                  <ComponentCard
                    key={`${item.source}-${item.id}`}
                    item={item}
                    onDelete={handleDelete}
                    onEdit={handleEdit}
                  />
                ))}
              </div>
            </section>
          ) : null,
        )}
        {filteredItems.length === 0 && (
          <div className="grid min-h-52 place-items-center rounded-2xl bg-surface-2/50 py-10 text-center">
            <div>
              <Boxes className="mx-auto h-7 w-7 text-muted-foreground/40" />
              <p className="mt-3 text-[13px] font-medium">{t("components.empty.title")}</p>
              <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                {t("components.empty.description")}
              </p>
            </div>
          </div>
        )}
      </div>

      {editingItem && editingAsset && (
        <ComponentEditor
          open
          key={editingItem.id}
          asset={editingAsset}
          item={editingItem}
          onOpenChange={handleEditorOpenChange}
        />
      )}
      <DeleteComponentDialog
        item={pendingDelete}
        open={!!pendingDelete}
        usageCount={deleteUsageCount}
        onConfirm={handleDeleteConfirm}
        onOpenChange={handleDeleteOpenChange}
      />
      <FindForMeModal open={findOpen} operations={operations} onOpenChange={handleFindOpenChange} />
    </div>
  );
};

import { useMemo, useState } from "react";
import { Boxes, Cpu, Download, Plus, Search, Upload, Workflow } from "lucide-react";
import { useDelete, useList } from "@refinedev/core";
import { useStore } from "zustand";
import { Button } from "@repo/ui/button";
import type { PipelineAsset } from "@repo/schemas";
import { PageHeader } from "@/components/PageHeader";
import { Chip, Icon, SearchInput } from "@/components/primitives";
import { ResourceName, dataProvider } from "@/integrations/refine/dataProvider";
import { useToastStore } from "@/store/toastStore";
import { ComponentCard, type ComponentCardItem, type ComponentCategory } from "../ComponentCard";
import { ComponentEditor } from "../ComponentEditor";
import { DeleteComponentDialog } from "../DeleteComponentDialog";

const CATEGORY_ICONS = {
  "Input Objects": Download,
  Operations: Cpu,
  Output: Upload,
  "Pipeline Skill": Workflow,
} satisfies Record<ComponentCategory, typeof Boxes>;

const TEMPLATE_COMPONENTS: ComponentCardItem[] = [
  {
    id: "template-folder",
    category: "Input Objects",
    description: "Bind a local folder as a reusable input source.",
    icon: Download,
    io: "folder -> files[]",
    meta: "local-fs",
    name: "Folder",
    source: "template",
    usageCount: 0,
  },
  {
    id: "template-operation",
    category: "Operations",
    description: "Prompt-backed operation template for agent work.",
    icon: Cpu,
    io: "input -> output",
    meta: "agent skill",
    name: "Agent Operation",
    source: "template",
    usageCount: 0,
  },
  {
    id: "template-output",
    category: "Output",
    description: "Write artifacts back to a local or project path.",
    icon: Upload,
    io: "any -> file",
    meta: "local output",
    name: "Local Path",
    source: "template",
    usageCount: 0,
  },
];

const CATEGORIES = ["All", "Input Objects", "Operations", "Output", "Pipeline Skill"] as const;
const COMPONENT_CATEGORIES = ["Input Objects", "Operations", "Output", "Pipeline Skill"] as const;
type ActiveCategory = (typeof CATEGORIES)[number];

const toAssetItem = (asset: PipelineAsset): ComponentCardItem => ({
  id: asset.id,
  category: "Pipeline Skill",
  description: asset.description || "Reusable pipeline distilled from a successful run.",
  icon: Workflow,
  io: `${asset.inputSlots.length} inputs -> pipeline`,
  meta: `${asset.snapshotNodes.length} nodes`,
  name: asset.name,
  source: "asset",
  usageCount: asset.totalRuns,
});

export const ComponentsPageContent = () => {
  const [active, setActive] = useState<ActiveCategory>("All");
  const [search, setSearch] = useState("");
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [localItems, setLocalItems] = useState<ComponentCardItem[]>([]);
  const [editingItem, setEditingItem] = useState<ComponentCardItem | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ComponentCardItem | null>(null);
  const [deleteUsageCount, setDeleteUsageCount] = useState(0);
  const { result: assetsResult } = useList<PipelineAsset>({
    resource: ResourceName.pipelineAssets,
  });
  const { mutate: deleteAsset } = useDelete();
  const toastStore = useToastStore();
  const addToast = useStore(toastStore, (state) => state.addToast);
  const assets = assetsResult.data;
  const assetItems = useMemo(() => assets.map(toAssetItem), [assets]);
  const items = useMemo(
    () => [...TEMPLATE_COMPONENTS, ...localItems, ...assetItems],
    [assetItems, localItems],
  );
  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();

    return items.filter((item) => {
      const matchesCategory = active === "All" || item.category === active;
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.meta.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q);

      return matchesCategory && matchesSearch;
    });
  }, [active, items, search]);
  const counts = useMemo(
    () =>
      Object.fromEntries(
        CATEGORIES.map((category) => [
          category,
          category === "All"
            ? items.length
            : items.filter((item) => item.category === category).length,
        ]),
      ) as Record<ActiveCategory, number>,
    [items],
  );
  const visibleCategories: readonly ComponentCategory[] =
    active === "All" ? COMPONENT_CATEGORIES : [active];
  const sections = visibleCategories.map((category) => ({
    category,
    items: filteredItems.filter((item) => item.category === category),
  }));
  const editingAsset =
    editingItem?.source === "asset"
      ? assets.find((asset) => asset.id === editingItem.id)
      : undefined;

  const handleFindClick = () => {
    addToast({
      type: "success",
      title: "Find for me",
      description: "Agent is searching your component library.",
    });
  };
  const handleNewMenuButtonClick = () => {
    setNewMenuOpen((open) => !open);
  };
  const handleCreateClick = (category: Exclude<ComponentCategory, "Pipeline Skill">) => {
    const item: ComponentCardItem = {
      id: `local-${category}-${Date.now()}`,
      category,
      description: "Draft component template.",
      icon: CATEGORY_ICONS[category],
      io: category === "Input Objects" ? "source -> output" : "input -> output",
      meta: "draft",
      name: `Untitled ${category === "Input Objects" ? "input" : category.toLowerCase()}`,
      source: "template",
      usageCount: 0,
    };
    setLocalItems((current) => [item, ...current]);
    setEditingItem(item);
    setNewMenuOpen(false);
  };
  const handleEdit = (item: ComponentCardItem) => setEditingItem(item);
  const handleCategoryClick = (category: ActiveCategory) => {
    setActive(category);
  };
  const handleSearchChange = (value: string) => {
    setSearch(value);
  };
  const handleSearchClear = () => {
    setSearch("");
  };
  const handleDelete = (item: ComponentCardItem) => {
    setPendingDelete(item);
    setDeleteUsageCount(item.usageCount);
    if (item.source !== "asset") return;

    void dataProvider.custom!<{ count: number }, unknown, { id: string }>({
      url: "pipelineAssets/getUsageCount",
      method: "get",
      payload: { id: item.id },
    }).then(({ data }) => setDeleteUsageCount(data.count));
  };
  const handleConfirmDelete = () => {
    if (!pendingDelete) return;
    if (pendingDelete.source === "asset") {
      deleteAsset({ resource: ResourceName.pipelineAssets, id: pendingDelete.id });
    } else {
      setLocalItems((current) => current.filter((item) => item.id !== pendingDelete.id));
    }
    setPendingDelete(null);
  };
  const handleEditorOpenChange = (open: boolean) => {
    if (!open) setEditingItem(null);
  };
  const handleDeleteDialogOpenChange = (open: boolean) => {
    if (!open) setPendingDelete(null);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={handleFindClick}>
              <Search className="h-3.5 w-3.5" />
              Find for me
            </Button>
            <div className="relative">
              <Button size="sm" onClick={handleNewMenuButtonClick}>
                <Plus className="h-3.5 w-3.5" />
                New Component
              </Button>
              {newMenuOpen ? (
                <div className="absolute right-0 top-full z-30 mt-1 w-48 rounded-xl bg-surface p-1.5 shadow-float ring-1 ring-border-strong">
                  {(["Input Objects", "Operations", "Output"] as const).map((category) => (
                    <button
                      key={category}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] hover:bg-accent/60"
                      type="button"
                      onClick={() => handleCreateClick(category)}
                    >
                      <Icon icon={CATEGORY_ICONS[category]} size={13} />
                      {category}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        }
        eyebrow="Assembly"
        icon={<Icon className="text-muted-foreground" icon={Boxes} size={18} />}
        sub="Your reusable asset library. Pipelines reuse these before creating anything new."
        title="Components"
      />

      <div className="flex items-center gap-2 px-7 pb-3.5">
        <div className="flex items-center gap-0.5">
          {CATEGORIES.map((category) => (
            <Chip
              key={category}
              active={active === category}
              count={counts[category]}
              onClick={() => handleCategoryClick(category)}
            >
              {category}
            </Chip>
          ))}
        </div>
        <SearchInput
          className="ml-auto w-60"
          placeholder="Search components..."
          value={search}
          onChange={handleSearchChange}
          onClear={handleSearchClear}
        />
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-7 pb-8">
        {sections.map(({ category, items: sectionItems }) =>
          sectionItems.length > 0 ? (
            <section key={category}>
              <div className="mb-2.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                <Icon icon={CATEGORY_ICONS[category]} size={13} />
                {category}
                <span className="rounded-full bg-surface-2 px-1.5 text-[10px]">
                  {sectionItems.length}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-3">
                {sectionItems.map((item) => (
                  <ComponentCard
                    key={item.id}
                    item={item}
                    onDelete={handleDelete}
                    onEdit={handleEdit}
                  />
                ))}
              </div>
            </section>
          ) : null,
        )}
        {filteredItems.length === 0 ? (
          <div className="grid place-items-center rounded-2xl bg-surface-2/50 py-16 text-center">
            <div className="text-[13px] font-medium">No matching components</div>
            <div className="mt-0.5 text-[11.5px] text-muted-foreground">
              Try another category or search term.
            </div>
          </div>
        ) : null}
      </div>

      {editingItem ? (
        <ComponentEditor
          asset={editingAsset}
          item={editingItem}
          open={!!editingItem}
          onOpenChange={handleEditorOpenChange}
        />
      ) : null}
      <DeleteComponentDialog
        item={pendingDelete}
        open={!!pendingDelete}
        usageCount={deleteUsageCount}
        onConfirm={handleConfirmDelete}
        onOpenChange={handleDeleteDialogOpenChange}
      />
    </div>
  );
};

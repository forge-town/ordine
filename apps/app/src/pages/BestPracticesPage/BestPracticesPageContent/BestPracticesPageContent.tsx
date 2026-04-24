import { type ChangeEvent, useRef } from "react";
import { useStore } from "zustand";
import { BookOpen, Download, Plus, Search, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import type { BestPractice } from "@repo/schemas";
import {
  exportAllBestPractices,
  parseBestPracticesZip,
  previewBestPracticesImport,
  submitBestPracticesImport,
} from "@/lib/exportBestPractice";
import { useDelete, useInvalidate, useList } from "@refinedev/core";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { useToastStore } from "@/store/toastStore";
import { PageLoadingState } from "@/components/PageLoadingState";
import { PageHeader } from "@/components/PageHeader";
import { useBestPracticesPageStore } from "../_store";
import { CATEGORIES } from "../constants";
import { PracticeFormDialog } from "../PracticeFormDialog";
import { PracticeCard } from "../PracticeCard";
import { ImportPreviewDialog } from "../ImportPreviewDialog";

const handleExport = () => void exportAllBestPractices();

const handleSave = (_p: BestPractice) => {};

export const BestPracticesPageContent = () => {
  const { t } = useTranslation();
  const invalidate = useInvalidate();
  const toastStore = useToastStore();
  const store = useBestPracticesPageStore();
  const search = useStore(store, (s) => s.search);
  const activeCategory = useStore(store, (s) => s.activeCategory);
  const showForm = useStore(store, (s) => s.showForm);
  const handleSetSearch = useStore(store, (s) => s.handleSetSearch);
  const handleSetActiveCategory = useStore(store, (s) => s.handleSetActiveCategory);
  const handleSetShowForm = useStore(store, (s) => s.handleSetShowForm);
  const handleSetImportPreview = useStore(store, (s) => s.handleSetImportPreview);
  const handleSetPendingEntries = useStore(store, (s) => s.handleSetPendingEntries);
  const pendingEntries = useStore(store, (s) => s.pendingEntries);
  const handleSetImportLoading = useStore(store, (s) => s.handleSetImportLoading);
  const handleResetImport = useStore(store, (s) => s.handleResetImport);

  const { result: practicesResult, query: practicesQuery } = useList<BestPractice>({
    resource: ResourceName.bestPractices,
  });
  const practices = practicesResult?.data ?? [];
  const { mutate: deleteBpMutate } = useDelete();

  const filtered = practices.filter((p: BestPractice) => {
    const matchCat = activeCategory === "all" || p.category === activeCategory;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      p.title.toLowerCase().includes(q) ||
      p.condition.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q));

    return matchCat && matchSearch;
  });

  const handleDelete = (id: string) => {
    deleteBpMutate({ resource: ResourceName.bestPractices, id });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    handleSetSearch(e.target.value);

  const handleCategoryClick = (catValue: string) => () => handleSetActiveCategory(catValue);

  const handleAddPractice = () => {
    handleSetShowForm(true);
  };

  const handleDeletePractice = (id: string) => () => void handleDelete(id);

  const handleFormClose = () => {
    handleSetShowForm(false);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const entries = await parseBestPracticesZip(file);
    const preview = await previewBestPracticesImport(entries);
    handleSetPendingEntries(entries);
    handleSetImportPreview(preview);
  };

  const handleImportConfirm = async () => {
    if (!pendingEntries) return;
    handleSetImportLoading(true);
    const result = await submitBestPracticesImport(pendingEntries);
    handleResetImport();
    toastStore.getState().addToast({
      type: "success",
      title: t("bestPractices.importSuccess", {
        defaultValue: `导入成功: ${String(result.imported)} 条最佳实践`,
      }),
    });
    void invalidate({ resource: ResourceName.bestPractices, invalidates: ["list"] });
  };

  const handleImportClick = () => fileInputRef.current?.click();

  if (practicesQuery?.isLoading) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <PageHeader title={t("bestPractices.title")} />
        <PageLoadingState variant="list" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        actions={
          <>
            <input
              ref={fileInputRef}
              accept=".bestpractice"
              className="hidden"
              type="file"
              onChange={handleFileChange}
            />
            <Button size="sm" variant="outline" onClick={handleImportClick}>
              <Upload className="h-4 w-4" />
              {t("common.import")}
            </Button>
            <Button size="sm" variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4" />
              {t("common.export")}
            </Button>
            <Button size="sm" onClick={handleAddPractice}>
              <Plus className="h-4 w-4" />
              {t("bestPractices.addNew")}
            </Button>
          </>
        }
        title={t("bestPractices.title")}
      />

      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-border bg-background px-6 py-3 flex-wrap">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 pl-8 text-sm"
            placeholder={t("bestPractices.searchPlaceholder")}
            type="text"
            value={search}
            onChange={handleSearchChange}
          />
        </div>

        {/* Category tabs */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {CATEGORIES.map((cat) => (
            <Button
              key={cat.value}
              className="h-7 whitespace-nowrap px-3 text-xs"
              size="sm"
              variant={activeCategory === cat.value ? "default" : "ghost"}
              onClick={handleCategoryClick(cat.value)}
            >
              {cat.label}
              {cat.value !== "all" && (
                <span className="ml-1 text-[10px] opacity-70">
                  {practices.filter((p) => p.category === cat.value).length}
                </span>
              )}
            </Button>
          ))}
        </div>

        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} {t("bestPractices.count")}
        </span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <BookOpen className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-foreground">
              {search || activeCategory !== "all"
                ? t("common.notFound")
                : t("bestPractices.noItems")}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {search || activeCategory !== "all" ? t("common.search") : t("bestPractices.addNew")}
            </p>
            {!search && activeCategory === "all" && (
              <Button className="mt-4" onClick={handleAddPractice}>
                <Plus className="h-4 w-4" />
                {t("bestPractices.addNew")}
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 max-w-4xl">
            {filtered.map((p) => (
              <PracticeCard key={p.id} practice={p} onDelete={handleDeletePractice(p.id)} />
            ))}
          </div>
        )}
      </div>

      {showForm && <PracticeFormDialog onClose={handleFormClose} onSave={handleSave} />}

      <ImportPreviewDialog onConfirm={handleImportConfirm} />
    </div>
  );
};

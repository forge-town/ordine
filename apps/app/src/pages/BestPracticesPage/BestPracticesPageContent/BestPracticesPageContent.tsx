import { type ChangeEvent, useRef, useState } from "react";
import { BookOpen, Download, Plus, Search, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import type { BestPracticeEntity } from "@repo/models";
import { exportAllBestPractices, importBestPracticesFromZip } from "@/lib/exportBestPractice";
import { useDelete } from "@refinedev/core";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { Route } from "@/routes/_layout/best-practices.index";
import { CATEGORIES } from "../constants";
import { PracticeFormDialog } from "../PracticeFormDialog";
import { PracticeCard } from "../PracticeCard";

const handleExport = () => void exportAllBestPractices();

const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  await importBestPracticesFromZip(file);
  globalThis.location.reload();
  e.target.value = "";
};

export const BestPracticesPageContent = () => {
  const { t } = useTranslation();
  const initialPractices = Route.useLoaderData() as BestPracticeEntity[];
  const [practices, setPractices] = useState<BestPracticeEntity[]>(initialPractices);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const { mutate: deleteBpMutate } = useDelete();

  const filtered = practices.filter((p) => {
    const matchCat = activeCategory === "all" || p.category === activeCategory;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      p.title.toLowerCase().includes(q) ||
      p.condition.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q));
    return matchCat && matchSearch;
  });

  const handleSave = (p: BestPracticeEntity) => {
    setPractices((prev) => [p, ...prev]);
  };

  const handleDelete = (id: string) => {
    setPractices((prev) => prev.filter((p) => p.id !== id));
    deleteBpMutate({ resource: ResourceName.bestPractices, id });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value);

  const handleCategoryClick = (catValue: string) => () => setActiveCategory(catValue);

  const handleAddPractice = () => {
    setShowForm(true);
  };

  const handleDeletePractice = (id: string) => () => void handleDelete(id);

  const handleFormClose = () => {
    setShowForm(false);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => fileInputRef.current?.click();

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-6">
        <h1 className="text-base font-semibold text-foreground">{t("bestPractices.title")}</h1>
        <div className="flex items-center gap-2">
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
        </div>
      </div>

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
    </div>
  );
};

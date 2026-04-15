import { useState } from "react";
import { ChefHat, Plus, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import type { RecipeRecord, OperationRecord, BestPracticeRecord } from "@repo/db-schema";
import { useDelete, useList } from "@refinedev/core";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { RecipeFormDialog } from "../RecipeFormDialog";
import { RecipeCard } from "../RecipeCard";

export const RecipesPageContent = () => {
  const { t } = useTranslation();
  const { result: recipesResult } = useList<RecipeRecord>({ resource: ResourceName.recipes });
  const { result: operationsResult } = useList<OperationRecord>({
    resource: ResourceName.operations,
  });
  const { result: bestPracticesResult } = useList<BestPracticeRecord>({
    resource: ResourceName.bestPractices,
  });
  const recipes = recipesResult?.data ?? [];
  const operations = operationsResult?.data ?? [];
  const bestPractices = bestPracticesResult?.data ?? [];
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<RecipeRecord | null>(null);
  const { mutate: deleteRecipeMutate } = useDelete();

  const filtered = recipes.filter((r: RecipeRecord) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return r.name.toLowerCase().includes(q) || (r.description ?? "").toLowerCase().includes(q);
  });

  const handleSave = (_r: RecipeRecord) => {};

  const handleDelete = (id: string) => {
    deleteRecipeMutate({ resource: ResourceName.recipes, id });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value);

  const handleAddRecipe = () => {
    setEditing(null);
    setShowForm(true);
  };

  const handleEditRecipe = (r: RecipeRecord) => () => {
    setEditing(r);
    setShowForm(true);
  };

  const handleDeleteRecipe = (id: string) => () => void handleDelete(id);

  const handleFormClose = () => {
    setShowForm(false);
    setEditing(null);
  };

  const opMap = new Map<string, OperationRecord>(operations.map((o: OperationRecord) => [o.id, o]));
  const bpMap = new Map<string, BestPracticeRecord>(
    bestPractices.map((bp: BestPracticeRecord) => [bp.id, bp])
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-6">
        <h1 className="text-base font-semibold text-foreground">{t("recipes.title")}</h1>
        <Button size="sm" onClick={handleAddRecipe}>
          <Plus className="h-4 w-4" />
          {t("recipes.addNew")}
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-border bg-background px-6 py-3">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 pl-8 text-sm"
            placeholder={t("recipes.searchPlaceholder")}
            type="text"
            value={search}
            onChange={handleSearchChange}
          />
        </div>
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} {t("recipes.count")}
        </span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <ChefHat className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-foreground">
              {search ? t("common.notFound") : t("recipes.noItems")}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {search ? t("common.search") : t("recipes.noItemsHint")}
            </p>
            {!search && (
              <Button className="mt-4" onClick={handleAddRecipe}>
                <Plus className="h-4 w-4" />
                {t("recipes.addNew")}
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 max-w-4xl">
            {filtered.map((r) => (
              <RecipeCard
                key={r.id}
                bestPractice={bpMap.get(r.bestPracticeId)}
                operation={opMap.get(r.operationId)}
                recipe={r}
                onDelete={handleDeleteRecipe(r.id)}
                onEdit={handleEditRecipe(r)}
              />
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <RecipeFormDialog
          bestPractices={bestPractices}
          initial={editing ?? undefined}
          operations={operations}
          onClose={handleFormClose}
          onSave={handleSave}
        />
      )}
    </div>
  );
};

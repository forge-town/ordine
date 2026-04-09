import { useState } from "react";
import { ChefHat, Plus, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import type { RecipeEntity } from "@/models/daos/recipesDao";
import type { OperationEntity } from "@/models/daos/operationsDao";
import type { BestPracticeEntity } from "@/models/daos/bestPracticesDao";
import { deleteRecipe } from "@/services/recipesService";
import { Route } from "@/routes/_layout/recipes";
import { RecipeFormDialog } from "../RecipeFormDialog";
import { RecipeCard } from "../RecipeCard";

export const RecipesPageContent = () => {
  const { t } = useTranslation();
  const loaderData = Route.useLoaderData() as {
    recipes: RecipeEntity[];
    operations: OperationEntity[];
    bestPractices: BestPracticeEntity[];
  };
  const [recipes, setRecipes] = useState<RecipeEntity[]>(loaderData.recipes);
  const operations = loaderData.operations;
  const bestPractices = loaderData.bestPractices;
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<RecipeEntity | null>(null);

  const filtered = recipes.filter((r) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      r.name.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q)
    );
  });

  const handleSave = (r: RecipeEntity) => {
    setRecipes((prev) => {
      const idx = prev.findIndex((x) => x.id === r.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = r;
        return next;
      }
      return [r, ...prev];
    });
  };

  const handleDelete = async (id: string) => {
    setRecipes((prev) => prev.filter((r) => r.id !== id));
    await deleteRecipe({ data: { id } });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setSearch(e.target.value);

  const handleAddRecipe = () => {
    setEditing(null);
    setShowForm(true);
  };

  const handleEditRecipe = (r: RecipeEntity) => () => {
    setEditing(r);
    setShowForm(true);
  };

  const handleDeleteRecipe = (id: string) => () => void handleDelete(id);

  const handleFormClose = () => {
    setShowForm(false);
    setEditing(null);
  };

  const opMap = new Map<string, OperationEntity>(
    operations.map((o) => [o.id, o]),
  );
  const bpMap = new Map<string, BestPracticeEntity>(
    bestPractices.map((bp) => [bp.id, bp]),
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-6">
        <h1 className="text-base font-semibold text-foreground">
          {t("recipes.title")}
        </h1>
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

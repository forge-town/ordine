import { useStore } from "zustand";
import { ChefHat, Plus, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import type { Recipe, Operation, BestPractice } from "@repo/schemas";
import { useDelete, useList } from "@refinedev/core";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { PageLoadingState } from "@/components/PageLoadingState";
import { PageHeader } from "@/components/PageHeader";
import { useRecipesPageStore } from "../_store";
import { RecipeFormDialog } from "../RecipeFormDialog";
import { RecipeCard } from "../RecipeCard";

const handleSave = (_r: Recipe) => {};

export const RecipesPageContent = () => {
  const { t } = useTranslation();
  const { result: recipesResult, query: recipesQuery } = useList<Recipe>({
    resource: ResourceName.recipes,
  });
  const { result: operationsResult, query: operationsQuery } = useList<Operation>({
    resource: ResourceName.operations,
  });
  const { result: bestPracticesResult, query: bestPracticesQuery } = useList<BestPractice>({
    resource: ResourceName.bestPractices,
  });
  const recipes = recipesResult?.data ?? [];
  const operations = operationsResult?.data ?? [];
  const bestPractices = bestPracticesResult?.data ?? [];
  const store = useRecipesPageStore();
  const search = useStore(store, (s) => s.search);
  const showForm = useStore(store, (s) => s.showForm);
  const editing = useStore(store, (s) => s.editing);
  const handleSetSearch = useStore(store, (s) => s.handleSetSearch);
  const handleSetShowForm = useStore(store, (s) => s.handleSetShowForm);
  const handleSetEditing = useStore(store, (s) => s.handleSetEditing);
  const { mutate: deleteRecipeMutate } = useDelete();

  const filtered = recipes.filter((r: Recipe) => {
    const q = search.toLowerCase();
    if (!q) return true;

    return r.name.toLowerCase().includes(q) || (r.description ?? "").toLowerCase().includes(q);
  });

  const handleDelete = (id: string) => {
    deleteRecipeMutate({ resource: ResourceName.recipes, id });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    handleSetSearch(e.target.value);

  const handleAddRecipe = () => {
    handleSetEditing(null);
    handleSetShowForm(true);
  };

  const handleEditRecipe = (r: Recipe) => () => {
    handleSetEditing(r);
    handleSetShowForm(true);
  };

  const handleDeleteRecipe = (id: string) => () => void handleDelete(id);

  const handleFormClose = () => {
    handleSetShowForm(false);
    handleSetEditing(null);
  };

  const opMap = new Map<string, Operation>(operations.map((o: Operation) => [o.id, o]));
  const bpMap = new Map<string, BestPractice>(bestPractices.map((bp: BestPractice) => [bp.id, bp]));

  if (recipesQuery?.isLoading || operationsQuery?.isLoading || bestPracticesQuery?.isLoading) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <PageHeader title={t("recipes.title")} />
        <PageLoadingState variant="list" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        actions={
          <Button size="sm" onClick={handleAddRecipe}>
            <Plus className="h-4 w-4" />
            {t("recipes.addNew")}
          </Button>
        }
        icon={<ChefHat className="h-4 w-4 text-primary" />}
        title={t("recipes.title")}
      />

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

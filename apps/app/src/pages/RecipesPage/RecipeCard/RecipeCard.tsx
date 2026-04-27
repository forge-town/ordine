import { ChefHat, Zap, Lightbulb, Pencil, Trash2 } from "lucide-react";
import type { Recipe, Operation, BestPractice } from "@repo/schemas";

export type RecipeCardProps = {
  recipe: Recipe;
  operation?: Operation;
  bestPractice?: BestPractice;
  onEdit: () => void;
  onDelete: () => void;
};

export const RecipeCard = ({
  recipe,
  operation,
  bestPractice,
  onEdit,
  onDelete,
}: RecipeCardProps) => {
  const handleEdit = onEdit;
  const handleDelete = onDelete;

  return (
    <div className="group rounded-xl border border-border bg-card overflow-hidden hover:border-primary/50 hover:shadow-sm transition-all">
      {/* Header */}
      <div className="flex items-start gap-3 p-4">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-100">
          <ChefHat className="h-4 w-4 text-orange-600" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground leading-snug">{recipe.name}</h3>
            <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                className="flex h-6 w-6 items-center justify-center rounded hover:bg-accent"
                onClick={handleEdit}
              >
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              <button
                className="flex h-6 w-6 items-center justify-center rounded hover:bg-destructive/10"
                onClick={handleDelete}
              >
                <Trash2 className="h-3.5 w-3.5 text-red-400" />
              </button>
            </div>
          </div>
          {recipe.description && (
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {recipe.description}
            </p>
          )}
        </div>
      </div>

      {/* Operation + Best Practice links */}
      <div className="border-t border-border bg-muted/30 px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-violet-500" />
          <span className="text-xs font-medium text-foreground">
            {operation?.name ?? recipe.operationId}
          </span>
        </div>
        <span className="text-muted-foreground text-xs">+</span>
        <div className="flex items-center gap-1.5">
          <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-xs font-medium text-foreground">
            {bestPractice?.title ?? recipe.bestPracticeId}
          </span>
        </div>
      </div>
    </div>
  );
};

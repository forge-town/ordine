import { createFileRoute } from "@tanstack/react-router";
import { RecipesPage } from "@/pages/RecipesPage";
import { getRecipes } from "@/services/recipesService";
import { getOperations } from "@/services/operationsService";
import { getBestPractices } from "@/services/bestPracticesService";

export const Route = createFileRoute("/_layout/recipes")({
  loader: async () => {
    const [recipes, operations, bestPractices] = await Promise.all([
      getRecipes(),
      getOperations(),
      getBestPractices(),
    ]);
    return { recipes, operations, bestPractices };
  },
  component: RecipesPage,
});

import { createFileRoute } from "@tanstack/react-router";
import { RecipesPage } from "@/pages/RecipesPage";

export const Route = createFileRoute("/_layout/recipes")({
  component: RecipesPage,
});

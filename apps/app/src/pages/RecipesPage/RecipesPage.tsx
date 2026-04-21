import { RecipesPageStoreProvider } from "./_store";
import { RecipesPageContent } from "./RecipesPageContent";

export const RecipesPage = () => {
  return (
    <RecipesPageStoreProvider>
      <RecipesPageContent />
    </RecipesPageStoreProvider>
  );
};

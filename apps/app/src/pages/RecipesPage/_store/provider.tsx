import { type ReactNode, useState } from "react";
import { RecipesPageStoreContext, createRecipesPageStore } from "./recipesPageStore";

interface Props {
  children: ReactNode;
}

export const RecipesPageStoreProvider = ({ children }: Props) => {
  const [store] = useState(() => createRecipesPageStore());

  return (
    <RecipesPageStoreContext.Provider value={store}>{children}</RecipesPageStoreContext.Provider>
  );
};

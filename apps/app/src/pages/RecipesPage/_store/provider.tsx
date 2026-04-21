import { type ReactNode } from "react";
import { RecipesPageStoreContext, createRecipesPageStore } from "./recipesPageStore";
import { useInit } from "@/hooks/useInit";

interface Props {
  children: ReactNode;
}

export const RecipesPageStoreProvider = ({ children }: Props) => {
  const store = useInit(() => createRecipesPageStore());

  return (
    <RecipesPageStoreContext.Provider value={store}>{children}</RecipesPageStoreContext.Provider>
  );
};

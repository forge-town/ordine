import { type ReactNode } from "react";
import { RulesPageStoreContext, createRulesPageStore } from "./rulesPageStore";
import { useInit } from "@/hooks/useInit";

interface Props {
  children: ReactNode;
}

export const RulesPageStoreProvider = ({ children }: Props) => {
  const store = useInit(() => createRulesPageStore());

  return <RulesPageStoreContext.Provider value={store}>{children}</RulesPageStoreContext.Provider>;
};

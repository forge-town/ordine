import { type ReactNode, useState } from "react";
import { RulesPageStoreContext, createRulesPageStore } from "./rulesPageStore";

interface Props {
  children: ReactNode;
}

export const RulesPageStoreProvider = ({ children }: Props) => {
  const [store] = useState(() => createRulesPageStore());

  return <RulesPageStoreContext.Provider value={store}>{children}</RulesPageStoreContext.Provider>;
};

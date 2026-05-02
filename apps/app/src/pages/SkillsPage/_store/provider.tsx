import { type ReactNode, useState } from "react";
import { SkillsPageStoreContext, createSkillsPageStore } from "./skillsPageStore";

interface Props {
  children: ReactNode;
}

export const SkillsPageStoreProvider = ({ children }: Props) => {
  const [store] = useState(() => createSkillsPageStore());

  return (
    <SkillsPageStoreContext.Provider value={store}>{children}</SkillsPageStoreContext.Provider>
  );
};

import { type ReactNode } from "react";
import { SkillsPageStoreContext, createSkillsPageStore } from "./skillsPageStore";
import { useInit } from "@/hooks/useInit";

interface Props {
  children: ReactNode;
}

export const SkillsPageStoreProvider = ({ children }: Props) => {
  const store = useInit(() => createSkillsPageStore());

  return (
    <SkillsPageStoreContext.Provider value={store}>{children}</SkillsPageStoreContext.Provider>
  );
};

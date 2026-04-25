import { type ReactNode } from "react";
import {
  DistillationStudioPageStoreContext,
  createDistillationStudioPageStore,
} from "./distillationStudioPageStore";
import { useInit } from "@/hooks/useInit";

interface Props {
  children: ReactNode;
}

export const DistillationStudioPageStoreProvider = ({ children }: Props) => {
  const store = useInit(() => createDistillationStudioPageStore());

  return (
    <DistillationStudioPageStoreContext.Provider value={store}>
      {children}
    </DistillationStudioPageStoreContext.Provider>
  );
};

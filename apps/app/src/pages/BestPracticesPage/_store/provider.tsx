import { type ReactNode } from "react";
import {
  BestPracticesPageStoreContext,
  createBestPracticesPageStore,
} from "./bestPracticesPageStore";
import { useInit } from "@/hooks/useInit";

interface Props {
  children: ReactNode;
}

export const BestPracticesPageStoreProvider = ({ children }: Props) => {
  const store = useInit(() => createBestPracticesPageStore());

  return (
    <BestPracticesPageStoreContext.Provider value={store}>
      {children}
    </BestPracticesPageStoreContext.Provider>
  );
};

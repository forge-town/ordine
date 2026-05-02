import { type ReactNode, useState } from "react";
import {
  BestPracticesPageStoreContext,
  createBestPracticesPageStore,
} from "./bestPracticesPageStore";

interface Props {
  children: ReactNode;
}

export const BestPracticesPageStoreProvider = ({ children }: Props) => {
  const [store] = useState(() => createBestPracticesPageStore());

  return (
    <BestPracticesPageStoreContext.Provider value={store}>
      {children}
    </BestPracticesPageStoreContext.Provider>
  );
};

import { type ReactNode, useState } from "react";
import {
  DistillationStudioPageStoreContext,
  createDistillationStudioPageStore,
} from "./distillationStudioPageStore";

interface Props {
  children: ReactNode;
}

export const DistillationStudioPageStoreProvider = ({ children }: Props) => {
  const [store] = useState(() => createDistillationStudioPageStore());

  return (
    <DistillationStudioPageStoreContext.Provider value={store}>
      {children}
    </DistillationStudioPageStoreContext.Provider>
  );
};

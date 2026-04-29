import { type ReactNode } from "react";
import {
  SettingsPageStoreContext,
  createSettingsPageStore,
  type AppSettings,
} from "./settingsPageStore";
import { useInit } from "@/hooks/useInit";

interface Props {
  children: ReactNode;
  initialSettings?: Partial<AppSettings>;
}

export const SettingsPageStoreProvider = ({ children, initialSettings }: Props) => {
  const store = useInit(() => createSettingsPageStore(initialSettings));

  return (
    <SettingsPageStoreContext.Provider value={store}>{children}</SettingsPageStoreContext.Provider>
  );
};

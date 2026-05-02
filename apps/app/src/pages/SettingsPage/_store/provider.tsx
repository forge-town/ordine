import { type ReactNode, useState } from "react";
import {
  SettingsPageStoreContext,
  createSettingsPageStore,
  type AppSettings,
} from "./settingsPageStore";

interface Props {
  children: ReactNode;
  initialSettings?: Partial<AppSettings>;
}

export const SettingsPageStoreProvider = ({ children, initialSettings }: Props) => {
  const [store] = useState(() => createSettingsPageStore(initialSettings));

  return (
    <SettingsPageStoreContext.Provider value={store}>{children}</SettingsPageStoreContext.Provider>
  );
};

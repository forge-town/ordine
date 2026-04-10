import { type ReactNode, useRef } from "react";
import {
  SettingsStoreContext,
  createSettingsStore,
  type SettingsStore,
  type AppSettings,
} from "./settingsStore";

interface Props {
  children: ReactNode;
  initialSettings?: Partial<AppSettings>;
}

export const SettingsStoreProvider = ({ children, initialSettings }: Props) => {
  const storeRef = useRef<SettingsStore | null>(null);

  if (!storeRef.current) {
    storeRef.current = createSettingsStore(initialSettings);
  }

  return (
    <SettingsStoreContext.Provider value={storeRef.current}>
      {children}
    </SettingsStoreContext.Provider>
  );
};

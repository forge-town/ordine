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
  const initialSettingsJsonRef = useRef<string | undefined>(undefined);
  const settingsJson = initialSettings ? JSON.stringify(initialSettings) : undefined;

  if (!storeRef.current || initialSettingsJsonRef.current !== settingsJson) {
    initialSettingsJsonRef.current = settingsJson;
    storeRef.current = createSettingsStore(initialSettings);
  }

  return (
    <SettingsStoreContext.Provider value={storeRef.current}>
      {children}
    </SettingsStoreContext.Provider>
  );
};

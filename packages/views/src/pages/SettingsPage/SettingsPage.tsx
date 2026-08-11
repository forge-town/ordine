import { useEffect, useState } from "react";
import { safeJsonParse } from "../../lib/safeJson";
import { SettingsPageStoreProvider, type AppSettings } from "./_store";
import { SettingsPageContent } from "./SettingsPageContent";

const STORAGE_KEY = "ordine_settings_v1";

const loadInitialSettings = (): Partial<AppSettings> | undefined => {
  if (typeof globalThis.localStorage === "undefined") return undefined;

  const raw = globalThis.localStorage.getItem(STORAGE_KEY);
  if (!raw) return undefined;
  const result = safeJsonParse<Partial<AppSettings>>(raw);

  return result.isOk() ? result.value : undefined;
};

export const SettingsPage = () => {
  const [hydratedSettings, setHydratedSettings] = useState<{
    ready: boolean;
    value?: Partial<AppSettings>;
  }>({ ready: false });

  useEffect(() => {
    setHydratedSettings({ ready: true, value: loadInitialSettings() });
  }, []);

  return (
    <SettingsPageStoreProvider
      key={hydratedSettings.ready ? "hydrated" : "server"}
      initialSettings={hydratedSettings.value}
    >
      <SettingsPageContent />
    </SettingsPageStoreProvider>
  );
};

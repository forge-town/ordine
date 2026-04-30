import { safeJsonParse } from "@/lib/safeJson";
import { SettingsPageStoreProvider, type AppSettings } from "./_store";
import { SettingsPageContent } from "./SettingsPageContent";

const STORAGE_KEY = "ordine_settings_v1";

const loadInitialSettings = (): Partial<AppSettings> | undefined => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return undefined;
  const result = safeJsonParse<Partial<AppSettings>>(raw);

  return result.isOk() ? result.value : undefined;
};

export const SettingsPage = () => {
  return (
    <SettingsPageStoreProvider initialSettings={loadInitialSettings()}>
      <SettingsPageContent />
    </SettingsPageStoreProvider>
  );
};

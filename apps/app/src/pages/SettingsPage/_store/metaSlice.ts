import type { SettingsStoreSlice, AppSettings } from "./settingsStore";

export interface MetaSlice {
  saved: boolean;
  updateSection: <K extends keyof AppSettings>(section: K, patch: Partial<AppSettings[K]>) => void;
  save: () => void;
  resetSaved: () => void;
}

const STORAGE_KEY = "ordine_settings_v1";

export const createMetaSlice = (
  set: Parameters<SettingsStoreSlice>[0],
  get: Parameters<SettingsStoreSlice>[1]
): MetaSlice => ({
  saved: false,

  updateSection: (section, patch) =>
    set((state) => ({
      [section]: { ...state[section], ...patch },
    })),

  save: () => {
    const {
      saved: _saved,
      updateSection: _updateSection,
      save: _save,
      resetSaved: _resetSaved,
      ...settings
    } = get();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    set({ saved: true });
  },

  resetSaved: () => set({ saved: false }),
});

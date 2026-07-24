import type { StateCreator } from "zustand";
import type { AppSettings, SettingsPageState } from "./settingsPageStore";

export interface SettingsPageMetaSlice {
  saved: boolean;
  updateSection: <K extends keyof AppSettings>(section: K, patch: Partial<AppSettings[K]>) => void;
  save: () => void;
  resetSaved: () => void;
}

const STORAGE_KEY = "ordine_settings_v1";

export const createSettingsPageMetaSlice: StateCreator<
  SettingsPageState,
  [],
  [],
  SettingsPageMetaSlice
> = (set, get) => ({
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

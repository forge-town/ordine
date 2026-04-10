import { createContext, useContext } from "react";
import { createStore, type StoreApi } from "zustand";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AppSettings {
  profile: {
    displayName: string;
    email: string;
    bio: string;
  };
  appearance: {
    theme: "light" | "dark" | "system";
  };
  notifications: {
    pipeline: boolean;
    mention: boolean;
    weekly: boolean;
  };
  language: {
    language: string;
    timezone: string;
  };
  security: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  };
}

export interface SettingsState extends AppSettings {
  saved: boolean;

  updateSection: <K extends keyof AppSettings>(section: K, patch: Partial<AppSettings[K]>) => void;
  save: () => void;
  resetSaved: () => void;
}

export type SettingsStore = StoreApi<SettingsState>;

// ─── Defaults ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = "ordine_settings_v1";

const defaultSettings: AppSettings = {
  profile: {
    displayName: "Ordine 用户",
    email: "user@ordine.app",
    bio: "Skill Pipeline 设计师",
  },
  appearance: { theme: "light" },
  notifications: {
    pipeline: true,
    mention: true,
    weekly: false,
  },
  language: {
    language: "zh-CN",
    timezone: "Asia/Shanghai",
  },
  security: {
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  },
};

// ─── Store factory ────────────────────────────────────────────────────────────

export const createSettingsStore = (initialOverrides?: Partial<AppSettings>): SettingsStore => {
  const initial: AppSettings = {
    profile: { ...defaultSettings.profile, ...initialOverrides?.profile },
    appearance: {
      ...defaultSettings.appearance,
      ...initialOverrides?.appearance,
    },
    notifications: {
      ...defaultSettings.notifications,
      ...initialOverrides?.notifications,
    },
    language: { ...defaultSettings.language, ...initialOverrides?.language },
    security: { ...defaultSettings.security, ...initialOverrides?.security },
  };

  return createStore<SettingsState>()((set, get) => ({
    ...initial,
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
  }));
};

// ─── Context ──────────────────────────────────────────────────────────────────

export const SettingsStoreContext = createContext<SettingsStore | null>(null);

export const useSettingsStore = (): SettingsStore => {
  const context = useContext(SettingsStoreContext);
  if (!context) {
    throw new Error("useSettingsStore must be used within a SettingsStoreProvider");
  }
  return context;
};

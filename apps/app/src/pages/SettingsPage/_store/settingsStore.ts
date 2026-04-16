import { createContext, useContext } from "react";
import { createStore, type StoreApi, type StateCreator } from "zustand";
import { createDataSlice, type DataSlice } from "./dataSlice";
import { createMetaSlice, type MetaSlice } from "./metaSlice";

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

export interface SettingsState extends DataSlice, MetaSlice {}

export type SettingsStore = StoreApi<SettingsState>;

export type SettingsStoreSlice<T = SettingsState> = StateCreator<SettingsState, [], [], T>;

// ─── Defaults ─────────────────────────────────────────────────────────────────

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
    ...createDataSlice(initial),
    ...createMetaSlice(
      set as Parameters<SettingsStoreSlice>[0],
      get as Parameters<SettingsStoreSlice>[1]
    ),
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

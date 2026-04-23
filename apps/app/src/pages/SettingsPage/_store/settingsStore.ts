import { createContext, useContext } from "react";
import { createStore, type StoreApi, type StateCreator } from "zustand";
import { createDataSlice, type DataSlice } from "./dataSlice";
import { createMetaSlice, type MetaSlice } from "./metaSlice";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AppSettings {
  language: {
    language: string;
    timezone: string;
  };
}

export interface SettingsState extends DataSlice, MetaSlice {}

export type SettingsStore = StoreApi<SettingsState>;

export type SettingsStoreSlice<T = SettingsState> = StateCreator<SettingsState, [], [], T>;

// ─── Defaults ─────────────────────────────────────────────────────────────────

const defaultSettings: AppSettings = {
  language: {
    language: "zh-CN",
    timezone: "Asia/Shanghai",
  },
};

// ─── Store factory ────────────────────────────────────────────────────────────

export const createSettingsStore = (initialOverrides?: Partial<AppSettings>): SettingsStore => {
  const initial: AppSettings = {
    language: { ...defaultSettings.language, ...initialOverrides?.language },
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

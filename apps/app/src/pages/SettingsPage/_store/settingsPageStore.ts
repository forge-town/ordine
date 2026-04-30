import { createContext, useContext } from "react";
import { createStore, type StoreApi, type StateCreator } from "zustand";
import { createSettingsPageDataSlice, type SettingsPageDataSlice } from "./settingsPageDataSlice";
import { createSettingsPageMetaSlice, type SettingsPageMetaSlice } from "./settingsPageMetaSlice";

export interface AppSettings {
  language: {
    language: string;
    timezone: string;
  };
}

export interface SettingsPageState extends SettingsPageDataSlice, SettingsPageMetaSlice {}

export type SettingsPageStoreSlice<T = SettingsPageState> = StateCreator<
  SettingsPageState,
  [],
  [],
  T
>;

export type SettingsPageStore = StoreApi<SettingsPageState>;

const defaultSettings: AppSettings = {
  language: {
    language: "zh-CN",
    timezone: "Asia/Shanghai",
  },
};

export const createSettingsPageStore = (
  initialOverrides?: Partial<AppSettings>
): SettingsPageStore => {
  const initial: AppSettings = {
    language: { ...defaultSettings.language, ...initialOverrides?.language },
  };

  return createStore<SettingsPageState>()((set, get, api) => ({
    ...createSettingsPageDataSlice(initial)(set, get, api),
    ...createSettingsPageMetaSlice(set, get, api),
  }));
};

export const SettingsPageStoreContext = createContext<SettingsPageStore | null>(null);

export const useSettingsPageStore = (): SettingsPageStore => {
  const context = useContext(SettingsPageStoreContext);
  if (!context) {
    throw new Error("useSettingsPageStore must be used within a SettingsPageStoreProvider");
  }

  return context;
};

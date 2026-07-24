import type { StateCreator } from "zustand";
import type { AppSettings, SettingsPageState } from "./settingsPageStore";

export interface SettingsPageDataSlice extends AppSettings {}

export const createSettingsPageDataSlice =
  (initial: AppSettings): StateCreator<SettingsPageState, [], [], SettingsPageDataSlice> =>
  () => ({
    ...initial,
  });

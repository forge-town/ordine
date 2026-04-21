import type { AppSettings } from "./settingsStore";

export interface DataSlice extends AppSettings {}

export const createDataSlice = (initial: AppSettings): DataSlice => ({
  ...initial,
});

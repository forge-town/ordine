import { createContext, useContext } from "react";
import { createStore, type StoreApi } from "zustand";
import { persist } from "zustand/middleware";

export const SELF_HEAL_RETRIES_MIN = 0;
export const SELF_HEAL_RETRIES_MAX = 5;
export const SELF_HEAL_RETRIES_DEFAULT = 1;

export interface AutonomyState {
  selfHealRetries: number;
  setSelfHealRetries: (value: number) => void;
}

export type AutonomyStore = StoreApi<AutonomyState>;
const clampRetries = (value: number) =>
  Math.min(SELF_HEAL_RETRIES_MAX, Math.max(SELF_HEAL_RETRIES_MIN, Math.round(value)));

export const createAutonomyStore = (): AutonomyStore =>
  createStore<AutonomyState>()(
    persist(
      (set) => ({
        selfHealRetries: SELF_HEAL_RETRIES_DEFAULT,
        setSelfHealRetries: (value) => set({ selfHealRetries: clampRetries(value) }),
      }),
      { name: "ordine.autonomy" },
    ),
  );

export const AutonomyStoreContext = createContext<AutonomyStore | null>(null);

export const useAutonomyStore = () => {
  const store = useContext(AutonomyStoreContext);
  if (!store) throw new Error("useAutonomyStore must be used within AutonomyStoreProvider");

  return store;
};

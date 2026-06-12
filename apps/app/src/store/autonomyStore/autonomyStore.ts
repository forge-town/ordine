import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * N18-05：Autonomy 偏好（原型 settings.jsx Autonomy 组）。
 * 设备级偏好（settings 表为固定列、加列需迁移，故不入库）；
 * 每次 Run 随请求下发，引擎据此决定 self-heal 重试轮数（0=失败即停）。
 */

export const SELF_HEAL_RETRIES_MIN = 0;
export const SELF_HEAL_RETRIES_MAX = 5;
export const SELF_HEAL_RETRIES_DEFAULT = 1;

type AutonomyState = {
  selfHealRetries: number;
  setSelfHealRetries: (value: number) => void;
};

const clamp = (value: number): number =>
  Math.min(SELF_HEAL_RETRIES_MAX, Math.max(SELF_HEAL_RETRIES_MIN, Math.round(value)));

export const useAutonomyStore = create<AutonomyState>()(
  persist(
    (set) => ({
      selfHealRetries: SELF_HEAL_RETRIES_DEFAULT,
      setSelfHealRetries: (value) => set({ selfHealRetries: clamp(value) }),
    }),
    { name: "ordine.autonomy" },
  ),
);

import { describe, expect, it } from "vitest";
import {
  createAutonomyStore,
  SELF_HEAL_RETRIES_DEFAULT,
  SELF_HEAL_RETRIES_MAX,
  SELF_HEAL_RETRIES_MIN,
} from "./autonomyStore";

describe("autonomyStore", () => {
  it("uses the safe default and clamps retry updates", () => {
    const store = createAutonomyStore();
    expect(store.getState().selfHealRetries).toBe(SELF_HEAL_RETRIES_DEFAULT);

    store.getState().setSelfHealRetries(99);
    expect(store.getState().selfHealRetries).toBe(SELF_HEAL_RETRIES_MAX);

    store.getState().setSelfHealRetries(-3);
    expect(store.getState().selfHealRetries).toBe(SELF_HEAL_RETRIES_MIN);

    store.getState().setSelfHealRetries(2.6);
    expect(store.getState().selfHealRetries).toBe(3);
  });
});

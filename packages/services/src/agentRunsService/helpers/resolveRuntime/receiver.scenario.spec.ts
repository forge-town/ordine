import { describe, expect, it, vi } from "vitest";
import { createResolveRuntimeHelper } from "./resolveRuntime.helper";

describe("ordinary injected function receivers", () => {
  it("reads the live scan dependency and preserves its original bare-call receiver", async () => {
    const receivers: unknown[] = [];
    const calls: string[] = [];
    const state = {
      scan: async function (this: unknown) {
        receivers.push(this);
        calls.push("original");

        return [];
      },
    };
    const resolve = createResolveRuntimeHelper({
      get scan() {
        return state.scan;
      },
      readExecutable: vi.fn(),
      probeCapabilities: vi.fn(),
    } as never);
    await expect(
      resolve({ type: "codex", connection: { mode: "local" } } as never),
    ).rejects.toThrow("Absolute executable path is unavailable");
    state.scan = async function (this: unknown) {
      receivers.push(this);
      calls.push("replacement");

      return [];
    };
    await expect(
      resolve({ type: "codex", connection: { mode: "local" } } as never),
    ).rejects.toThrow("Absolute executable path is unavailable");
    expect(receivers).toEqual([undefined, undefined]);
    expect(calls).toEqual(["original", "replacement"]);
  });
});

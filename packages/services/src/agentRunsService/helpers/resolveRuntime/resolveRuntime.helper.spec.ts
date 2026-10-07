import { describe, expect, it, vi } from "vitest";
import { createResolveRuntimeHelper } from "./resolveRuntime.helper";

describe("resolveRuntime", () => {
  it("retains the Agent Run boundary contract", async () => {
    const resolveRuntime = createResolveRuntimeHelper({
      scan: vi.fn().mockResolvedValue([]),
      readExecutable: vi.fn(),
      probeCapabilities: vi.fn(),
    } as never);
    await expect(
      resolveRuntime({ type: "codex", connection: { mode: "local" } } as never),
    ).rejects.toThrow("Absolute executable path is unavailable");
  });
});

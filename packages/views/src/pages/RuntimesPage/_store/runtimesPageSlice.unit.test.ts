import { describe, expect, it, vi } from "vitest";
import { createRuntimesPageStore } from "./runtimesPageStore";

describe("runtimesPageSlice", () => {
  it("uses the server catalog rescan without asking the UI to delete omitted runtimes", async () => {
    const store = createRuntimesPageStore();
    const rescanCatalog = vi
      .fn()
      .mockResolvedValue([
        { runtime: "codex" },
        { runtime: "claude-code" },
        { runtime: "opencode" },
      ]);

    await expect(store.getState().handleRescanButtonClick(rescanCatalog)).resolves.toBe(true);

    expect(rescanCatalog).toHaveBeenCalledOnce();
    expect(store.getState()).toMatchObject({
      isScanning: false,
      scanFailed: false,
      scannedRuntimeCount: 3,
    });
  });

  it("recovers from scan failures without leaving the page busy", async () => {
    const store = createRuntimesPageStore();

    await expect(
      store.getState().handleRescanButtonClick(() => Promise.reject(new Error("offline"))),
    ).resolves.toBe(false);

    expect(store.getState()).toMatchObject({ isScanning: false, scanFailed: true });
  });

  it("tracks the runtime selected for a connection test", () => {
    const store = createRuntimesPageStore();

    store.getState().handleConnectionTestOpenChange("local-codex");
    expect(store.getState().connectionTestRuntimeConfigId).toBe("local-codex");
    store.getState().handleConnectionTestOpenChange(null);
    expect(store.getState().connectionTestRuntimeConfigId).toBeNull();
  });
});

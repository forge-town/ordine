import { describe, expect, it, vi } from "vitest";
import type { AgentRuntimeConfig } from "@repo/schemas";
import { computeDiff } from "./runtimesPageSlice";
import { createRuntimesPageStore } from "./runtimesPageStore";

const detectedCodex = {
  type: "codex",
  binaryName: "codex",
  path: "C:\\tools\\codex.exe",
  version: "codex-cli 1.2.3",
};

describe("runtimesPageSlice", () => {
  it("marks a legacy saved runtime as updated and keeps detection metadata", () => {
    const existing: AgentRuntimeConfig[] = [
      {
        id: "local-codex",
        name: "My Codex",
        type: "codex",
        connection: { mode: "local" },
      },
    ];

    const diff = computeDiff(existing, [detectedCodex]);

    expect(diff.added).toHaveLength(0);
    expect(diff.updated).toHaveLength(1);
    expect(diff.updated[0]).toMatchObject({
      id: "local-codex",
      name: "My Codex",
      connection: {
        mode: "local",
        binaryName: "codex",
        path: "C:\\tools\\codex.exe",
        version: "codex-cli 1.2.3",
      },
    });
  });

  it("keeps matching detection metadata unchanged", () => {
    const existing: AgentRuntimeConfig[] = [
      {
        id: "local-codex",
        name: "Codex",
        type: "codex",
        connection: {
          mode: "local",
          binaryName: "codex",
          path: "C:\\tools\\codex.exe",
          version: "codex-cli 1.2.3",
        },
      },
    ];

    const diff = computeDiff(existing, [detectedCodex]);

    expect(diff.updated).toHaveLength(0);
    expect(diff.unchanged).toEqual(existing);
  });

  it("does not erase a saved catalog when probing models is unavailable", () => {
    const existing: AgentRuntimeConfig[] = [
      {
        id: "local-codex",
        name: "Codex",
        type: "codex",
        connection: {
          mode: "local",
          binaryName: "codex",
          path: "C:\\tools\\codex.exe",
          version: "codex-cli 1.2.3",
          models: [{ id: "gpt-5", displayName: "GPT-5" }],
        },
      },
    ];

    const diff = computeDiff(existing, [detectedCodex]);

    expect(diff.updated).toHaveLength(0);
    expect(diff.unchanged).toEqual(existing);
  });

  it("marks a runtime updated when its model catalog changes", () => {
    const existing: AgentRuntimeConfig[] = [
      {
        id: "local-codex",
        name: "Codex",
        type: "codex",
        connection: {
          mode: "local",
          binaryName: "codex",
          path: "C:\\tools\\codex.exe",
          version: "codex-cli 1.2.3",
          models: [{ id: "gpt-5", displayName: "GPT-5" }],
        },
      },
    ];

    const diff = computeDiff(existing, [
      { ...detectedCodex, models: [{ id: "gpt-5.6", displayName: "GPT-5.6" }] },
    ]);

    expect(diff.updated).toHaveLength(1);
    expect(diff.updated[0]?.connection).toMatchObject({
      models: [{ id: "gpt-5.6", displayName: "GPT-5.6" }],
    });
  });

  it("syncs added, updated, and removed runtimes through explicit mutations", async () => {
    const store = createRuntimesPageStore();
    const createRuntime = vi.fn().mockResolvedValue(undefined);
    const updateRuntime = vi.fn().mockResolvedValue(undefined);
    const deleteRuntime = vi.fn().mockResolvedValue(undefined);
    const existing: AgentRuntimeConfig[] = [
      {
        id: "local-claude-code",
        name: "claude-code",
        type: "claude-code",
        connection: { mode: "local" },
      },
      {
        id: "local-openclaw",
        name: "openclaw",
        type: "openclaw",
        connection: { mode: "local" },
      },
    ];

    await store.getState().handleScanButtonClick(existing, async () => [
      detectedCodex,
      {
        type: "claude-code",
        binaryName: "claude",
        path: "C:\\tools\\claude.cmd",
        version: "2.1.0",
      },
    ]);
    await store
      .getState()
      .handleConfirmSyncButtonClick({ createRuntime, updateRuntime, deleteRuntime });

    expect(createRuntime).toHaveBeenCalledWith(expect.objectContaining({ id: "local-codex" }));
    expect(updateRuntime).toHaveBeenCalledWith(
      expect.objectContaining({ id: "local-claude-code" }),
    );
    expect(deleteRuntime).toHaveBeenCalledWith("local-openclaw");
    expect(store.getState().scanDiff).toBeNull();
  });

  it("recovers from scan failures without leaving the page busy", async () => {
    const store = createRuntimesPageStore();

    await store.getState().handleScanButtonClick([], () => Promise.reject(new Error("offline")));

    expect(store.getState()).toMatchObject({ isScanning: false, scanFailed: true, scanDiff: null });
  });
});

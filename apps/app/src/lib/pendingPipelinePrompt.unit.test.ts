import { beforeEach, describe, expect, it } from "vitest";
import { savePendingPipelinePrompt, takePendingPipelinePrompt } from "./pendingPipelinePrompt";

describe("pendingPipelinePrompt", () => {
  beforeEach(() => {
    globalThis.sessionStorage.clear();
  });

  it("takes a saved prompt exactly once", () => {
    savePendingPipelinePrompt("build a hackathon scout", "runtime-codex");

    expect(takePendingPipelinePrompt()).toEqual({
      prompt: "build a hackathon scout",
      runtimeId: "runtime-codex",
    });
    expect(takePendingPipelinePrompt()).toBeNull();
  });

  it("returns null when nothing was saved", () => {
    expect(takePendingPipelinePrompt()).toBeNull();
  });

  it("overwrites a previous pending prompt with the latest one", () => {
    savePendingPipelinePrompt("first");
    savePendingPipelinePrompt("second");

    expect(takePendingPipelinePrompt()).toEqual({ prompt: "second" });
    expect(takePendingPipelinePrompt()).toBeNull();
  });

  it("reads the legacy plain-text prompt format", () => {
    globalThis.sessionStorage.setItem("ordine.pendingPipelinePrompt", "legacy prompt");

    expect(takePendingPipelinePrompt()).toEqual({ prompt: "legacy prompt" });
  });
});

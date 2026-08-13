import { beforeEach, describe, expect, it } from "vitest";
import { savePendingPipelinePrompt, takePendingPipelinePrompt } from "./pendingPipelinePrompt";

describe("pendingPipelinePrompt", () => {
  beforeEach(() => {
    globalThis.sessionStorage.clear();
  });

  it("takes a saved prompt exactly once", () => {
    savePendingPipelinePrompt("build a hackathon scout");

    expect(takePendingPipelinePrompt()).toBe("build a hackathon scout");
    expect(takePendingPipelinePrompt()).toBeNull();
  });

  it("returns null when nothing was saved", () => {
    expect(takePendingPipelinePrompt()).toBeNull();
  });

  it("overwrites a previous pending prompt with the latest one", () => {
    savePendingPipelinePrompt("first");
    savePendingPipelinePrompt("second");

    expect(takePendingPipelinePrompt()).toBe("second");
    expect(takePendingPipelinePrompt()).toBeNull();
  });
});

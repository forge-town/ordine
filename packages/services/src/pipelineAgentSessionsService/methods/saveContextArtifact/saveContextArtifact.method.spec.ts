import { describe, expect, it, vi } from "vitest";
import { createSaveContextArtifactMethod } from "./saveContextArtifact.method";
describe("saveContextArtifact", () => {
  it("retains the session persistence boundary", async () => {
    const create = vi.fn().mockImplementation(async (input) => input);
    const save = createSaveContextArtifactMethod({ contextArtifactsDao: { create } } as never);
    expect(
      await save("session-1", { kind: "text_extract", content: { text: "evidence" } }),
    ).toMatchObject({
      sessionId: "session-1",
      attachmentId: null,
      kind: "text_extract",
      content: { text: "evidence" },
    });
  });
});

import { describe, expect, it, vi } from "vitest";
import { createRegisterAttachmentMethod } from "./registerAttachment.method";
describe("registerAttachment", () => {
  it("retains the session persistence boundary", async () => {
    const create = vi.fn().mockImplementation(async (input) => input);
    const register = createRegisterAttachmentMethod({ attachmentsDao: { create } } as never);
    const attachment = await register("session-1", {
      filename: "brief.txt",
      mimeType: "text/plain",
      sizeBytes: 3,
      storageKey: "/safe/attachment.txt",
    });
    expect(attachment).toMatchObject({
      sessionId: "session-1",
      sourceType: "upload",
      parseStatus: "pending",
      parseError: null,
      storageKey: "/safe/attachment.txt",
    });
  });
});

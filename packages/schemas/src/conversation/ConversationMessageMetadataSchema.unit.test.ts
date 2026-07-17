import { describe, expect, it } from "vitest";
import { ConversationMessageMetadataSchema } from "./ConversationMessageMetadataSchema";

describe("ConversationMessageMetadataSchema", () => {
  it("accepts M5 attachment metadata with only a file name", () => {
    const result = ConversationMessageMetadataSchema.safeParse({
      attachments: [{ name: "sample.pdf" }],
      referencedNodeIds: ["node-1"],
    });

    expect(result.success).toBe(true);
  });
  it("keeps legacy metadata without resolved parseable and accepts the new flag", () => {
    expect(
      ConversationMessageMetadataSchema.safeParse({ referencedNodeIds: ["node-1"] }).success,
    ).toBe(true);

    const parsed = ConversationMessageMetadataSchema.parse({
      referencedNodeIds: ["node-1"],
      resolved: true,
    });
    expect(parsed.resolved).toBe(true);
  });
});

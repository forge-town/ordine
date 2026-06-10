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
});

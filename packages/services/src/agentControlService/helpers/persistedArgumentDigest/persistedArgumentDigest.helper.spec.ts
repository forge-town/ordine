import { describe, expect, it } from "vitest";
import { persistedArgumentDigest } from "./persistedArgumentDigest.helper";

describe("persistedArgumentDigest", () => {
  it("retains the Agent Control contract boundary", () => {
    expect(
      persistedArgumentDigest({ argumentDigest: "durable-digest", redactedInput: {} } as never),
    ).toBe("durable-digest");
  });
});

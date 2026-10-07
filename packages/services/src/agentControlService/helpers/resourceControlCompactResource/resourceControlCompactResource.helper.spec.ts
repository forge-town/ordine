import { describe, expect, it } from "vitest";
import { compactResource } from "./resourceControlCompactResource.helper";

describe("resourceControlCompactResource", () => {
  it("retains the Agent Control contract boundary", () => {
    expect(
      compactResource("connector", {
        id: "connector-1",
        config: { secret: "private" },
        encryptedCredentials: { cipher: "private" },
      }),
    ).toEqual({ id: "connector-1" });
  });
});

import { describe, expect, it } from "vitest";
import { createDecodePdfTextBytesHelper } from "./decodePdfTextBytes.helper";

describe("decodePdfTextBytes", () => {
  it("retains the planning and attachment boundary", () => {
    const decode = createDecodePdfTextBytesHelper({});
    expect(decode([0xfe, 0xff, 0, 65, 0x4e, 0x2d])).toBe("A中");
    expect(decode([...new TextEncoder().encode("hello")])).toBe("hello");
  });
});

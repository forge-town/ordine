import { describe, expect, it } from "vitest";
import { bytesOfJson } from "./bytesOfJson.helper";

describe("bytesOfJson", () => {
  it("retains the Agent Run boundary contract", () => {
    expect(bytesOfJson({ content: "你好" })).toBeGreaterThan(
      JSON.stringify({ content: "你好" }).length,
    );
  });
});

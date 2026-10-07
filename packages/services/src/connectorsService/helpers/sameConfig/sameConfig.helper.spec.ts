import { describe, expect, it } from "vitest";
import { sameConfig } from "./sameConfig.helper";
describe("sameConfig", () => {
  it("compares the full persisted configuration, including nested arguments", () => {
    const config = { transport: "stdio" as const, command: "tool", args: ["old"] };
    expect(sameConfig(config, { ...config })).toBe(true);
    expect(sameConfig(config, { ...config, args: ["new"] })).toBe(false);
  });
});

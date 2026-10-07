import { describe, expect, it } from "vitest";
import { stripHandshakeArtifacts } from "./stripHandshakeArtifacts.helper";
describe("stripHandshakeArtifacts", () => {
  it("removes stale handshake fields without modifying transport data or the input", () => {
    const config = {
      transport: "stdio" as const,
      command: "tool",
      tools: [{ name: "stale" }],
      lastError: "previous failure",
    };
    expect(stripHandshakeArtifacts(config)).toEqual({ transport: "stdio", command: "tool" });
    expect(config.tools).toEqual([{ name: "stale" }]);
    expect(config.lastError).toBe("previous failure");
  });
});

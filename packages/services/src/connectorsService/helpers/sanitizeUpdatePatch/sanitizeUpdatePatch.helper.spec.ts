import { describe, expect, it } from "vitest";
import type { Connector } from "../persistIfConfigUnchanged";
import { sanitizeUpdatePatch } from "./sanitizeUpdatePatch.helper";
describe("sanitizeUpdatePatch", () => {
  it("does not mutate either supplied or previously stored configuration during invalidation", () => {
    const config = {
      transport: "stdio",
      command: "tool",
      tools: [{ name: "forged" }],
      lastError: "stale",
    };
    const current = {
      method: "mcp",
      config: { transport: "stdio", command: "saved" },
    } as Connector;
    const sanitized = sanitizeUpdatePatch({ config }, current);
    expect(sanitized.config).toEqual({ transport: "stdio", command: "tool" });
    expect(sanitized).toMatchObject({
      status: "needs_setup",
      origin: "manual",
      lastSyncAt: null,
      encryptedCredentials: {},
      sources: [],
      signature: null,
    });
    expect(config.tools).toEqual([{ name: "forged" }]);
    expect(current.config).toEqual({ transport: "stdio", command: "saved" });
  });
});

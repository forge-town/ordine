import { describe, expect, it } from "vitest";
import { withLastError } from "./withLastError.helper";
describe("withLastError", () => {
  it("adds the current handshake failure while preserving the original config", () => {
    const config = { transport: "http" as const, url: "https://example.invalid/mcp" };
    expect(withLastError(config, "unavailable")).toEqual({ ...config, lastError: "unavailable" });
    expect(config).not.toHaveProperty("lastError");
  });
});

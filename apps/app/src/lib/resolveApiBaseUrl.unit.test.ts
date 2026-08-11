import { describe, expect, it } from "vitest";
import { resolveApiBaseUrl } from "./resolveApiBaseUrl";

describe("resolveApiBaseUrl", () => {
  it.each(["localhost", "127.0.0.1", "::1", "[::1]"])(
    "routes the local hostname %s to the standalone API server",
    (hostname) => {
      expect(resolveApiBaseUrl({ hostname, origin: `http://${hostname}:9430` })).toBe(
        "http://localhost:9433/api",
      );
    },
  );

  it("uses the current origin behind a production reverse proxy", () => {
    expect(
      resolveApiBaseUrl({ hostname: "ordine.example.com", origin: "https://ordine.example.com" }),
    ).toBe("https://ordine.example.com/api");
  });

  it("uses the local API server while rendering without a browser location", () => {
    expect(resolveApiBaseUrl()).toBe("http://localhost:9433/api");
  });
});

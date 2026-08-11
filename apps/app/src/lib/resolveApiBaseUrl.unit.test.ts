import { describe, expect, it } from "vitest";
import { resolveApiBaseUrl } from "./resolveApiBaseUrl";

describe("resolveApiBaseUrl", () => {
  it.each(["localhost", "127.0.0.1", "192.168.1.25", "devbox.local"])(
    "routes the development hostname %s to its standalone API server",
    (hostname) => {
      expect(
        resolveApiBaseUrl({ hostname, origin: `http://${hostname}:9430` }, { isDevelopment: true }),
      ).toBe(`http://${hostname}:9433/api`);
    },
  );

  it("formats an IPv6 development hostname safely", () => {
    expect(
      resolveApiBaseUrl({ hostname: "::1", origin: "http://[::1]:9430" }, { isDevelopment: true }),
    ).toBe("http://[::1]:9433/api");
  });

  it("prefers an explicit API base URL and removes trailing slashes", () => {
    expect(
      resolveApiBaseUrl(
        { hostname: "devbox.local", origin: "http://devbox.local:9430" },
        { explicitBaseUrl: " https://api.example.com/custom/ ", isDevelopment: true },
      ),
    ).toBe("https://api.example.com/custom");
  });

  it("uses the current origin behind a production reverse proxy", () => {
    expect(
      resolveApiBaseUrl(
        { hostname: "ordine.example.com", origin: "https://ordine.example.com" },
        { isDevelopment: false },
      ),
    ).toBe("https://ordine.example.com/api");
  });

  it("uses the local API server while rendering without a browser location", () => {
    expect(resolveApiBaseUrl(undefined, { isDevelopment: true })).toBe("http://localhost:9433/api");
  });

  it("uses a relative same-origin API path for production server rendering", () => {
    expect(resolveApiBaseUrl(undefined, { isDevelopment: false })).toBe("/api");
  });
});

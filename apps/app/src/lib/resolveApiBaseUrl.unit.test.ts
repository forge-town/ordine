import { describe, expect, it } from "vitest";
import { resolveApiBaseUrl } from "./resolveApiBaseUrl";

describe("resolveApiBaseUrl", () => {
  it("uses the browser origin so requests go through the app server proxy", () => {
    expect(resolveApiBaseUrl({ origin: "http://localhost:9430" })).toBe(
      "http://localhost:9430/api",
    );
  });

  it("uses the current origin behind a production reverse proxy", () => {
    expect(resolveApiBaseUrl({ origin: "https://ordine.example.com" })).toBe(
      "https://ordine.example.com/api",
    );
  });

  it("uses the local API server while rendering without a browser location", () => {
    expect(resolveApiBaseUrl()).toBe("http://localhost:9433/api");
  });
});

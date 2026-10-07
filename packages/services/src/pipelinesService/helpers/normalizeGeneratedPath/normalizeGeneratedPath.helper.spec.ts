import { describe, expect, it } from "vitest";
import { normalizeGeneratedPath } from "./normalizeGeneratedPath.helper";
import { homedir } from "node:os";
describe("normalizeGeneratedPath", () => {
  it("retains the Pipeline content and error boundary", () => {
    expect(normalizeGeneratedPath("~")).toBe(homedir());
    expect(normalizeGeneratedPath("relative/path")).toBe("relative/path");
  });
});

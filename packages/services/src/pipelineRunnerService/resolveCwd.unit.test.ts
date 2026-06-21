import { describe, it, expect } from "vitest";
import { resolveCwd } from "./resolveCwd";

describe("resolveCwd", () => {
  it("returns process.cwd() for undefined inputPath", () => {
    expect(resolveCwd({ inputPath: undefined })).toBe(process.cwd());
  });

  it("returns process.cwd() for https URL inputPath", () => {
    expect(resolveCwd({ inputPath: "https://github.com/owner/repo" })).toBe(process.cwd());
  });

  it("returns process.cwd() for http URL inputPath", () => {
    expect(resolveCwd({ inputPath: "http://example.com/path" })).toBe(process.cwd());
  });

  it("returns the path itself for a valid directory", () => {
    expect(resolveCwd({ inputPath: process.cwd() })).toBe(process.cwd());
  });
});

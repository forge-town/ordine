import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { expandHome, resolveCwd } from "./resolveCwd";

describe("expandHome", () => {
  it("expands bare ~ to homedir", () => {
    expect(expandHome("~")).toBe(homedir());
  });

  it("expands ~/sub to homedir/sub", () => {
    expect(expandHome("~/Desktop")).toBe(join(homedir(), "Desktop"));
  });

  it("leaves non-~ paths untouched", () => {
    expect(expandHome("/abs/path")).toBe("/abs/path");
    expect(expandHome("relative")).toBe("relative");
  });
});

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

  it("falls back to process.cwd() for non-existent placeholder paths", () => {
    expect(resolveCwd({ inputPath: "~/definitely-not-a-real-dir/article.md" })).toBe(process.cwd());
    expect(resolveCwd({ inputPath: join("/nope", "does", "not", "exist") })).toBe(process.cwd());
  });

  it("returns the parent directory for an existing file", () => {
    const file = fileURLToPath(import.meta.url);
    expect(resolveCwd({ inputPath: file })).toBe(dirname(file));
  });
});

import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, vi } from "vitest";

vi.mock("@repo/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { expandHome, resolveCwd, InputPathNotFoundError } from "./resolveCwd";

describe("expandHome", () => {
  it("expands bare ~ to homedir", () => {
    expect(expandHome("~")).toBe(homedir());
  });

  it("expands ~/sub to homedir/sub", () => {
    expect(expandHome("~/Desktop")).toBe(join(homedir(), "Desktop"));
  });

  it("expands a Windows-style ~\\sub prefix", () => {
    expect(expandHome("~\\Desktop")).toBe(join(homedir(), "Desktop"));
  });

  it("leaves non-~ paths untouched", () => {
    expect(expandHome("/abs/path")).toBe("/abs/path");
    expect(expandHome("relative")).toBe("relative");
  });
});

describe("resolveCwd", () => {
  it("falls back to process.cwd() for absent or blank inputPath", () => {
    expect(resolveCwd({ inputPath: undefined })._unsafeUnwrap()).toBe(process.cwd());
    expect(resolveCwd({ inputPath: "" })._unsafeUnwrap()).toBe(process.cwd());
    expect(resolveCwd({ inputPath: "   " })._unsafeUnwrap()).toBe(process.cwd());
  });

  it("falls back to process.cwd() for URL inputPath", () => {
    expect(resolveCwd({ inputPath: "https://github.com/owner/repo" })._unsafeUnwrap()).toBe(
      process.cwd(),
    );
    expect(resolveCwd({ inputPath: "http://example.com/path" })._unsafeUnwrap()).toBe(
      process.cwd(),
    );
  });

  it("returns the path itself for a valid directory", () => {
    expect(resolveCwd({ inputPath: process.cwd() })._unsafeUnwrap()).toBe(process.cwd());
  });

  it("returns the parent directory for an existing file", () => {
    const file = fileURLToPath(import.meta.url);
    expect(resolveCwd({ inputPath: file })._unsafeUnwrap()).toBe(dirname(file));
  });

  it("errors on an explicitly configured path that does not exist", () => {
    const missing = join("/nope", "does", "not", "exist");
    const result = resolveCwd({ inputPath: missing });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(InputPathNotFoundError);
      expect(result.error.message).toContain(missing);
      expect(result.error.message).toContain("existing file or folder");
    }
  });

  it("errors on a non-existent ~ path after expansion", () => {
    const result = resolveCwd({ inputPath: "~/definitely-not-a-real-dir/article.md" });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("~/definitely-not-a-real-dir/article.md");
    }
  });
});

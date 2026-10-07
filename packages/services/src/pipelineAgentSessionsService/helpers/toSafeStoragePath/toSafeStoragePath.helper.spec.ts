import { describe, expect, it } from "vitest";
import { toSafeStoragePath } from "./toSafeStoragePath.helper";
import { dirname, basename } from "node:path";
describe("toSafeStoragePath", () => {
  it("retains the planning and attachment boundary", () => {
    const path = toSafeStoragePath("../../session", "attachment-1", "../../brief.txt");
    expect(dirname(path.storageKey)).toBe(path.storageDir);
    expect(basename(path.storageKey)).toBe("attachment-1.txt");
    expect(() => toSafeStoragePath("session", "../../escaped", "file.txt")).toThrow(
      "escaped the session directory",
    );
  });
});

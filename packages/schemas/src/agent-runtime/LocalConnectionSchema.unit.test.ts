import { describe, expect, it } from "vitest";
import { LocalConnectionSchema } from "./LocalConnectionSchema";

describe("LocalConnectionSchema", () => {
  it("preserves optional local runtime detection metadata", () => {
    const connection = {
      mode: "local",
      binaryName: "codex",
      path: "C:\\tools\\codex.exe",
      version: "codex-cli 1.2.3",
      detectedAt: "2026-08-12T08:00:00.000Z",
    } as const;

    expect(LocalConnectionSchema.parse(connection)).toEqual(connection);
  });
});

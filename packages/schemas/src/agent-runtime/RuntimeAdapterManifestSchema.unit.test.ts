import { describe, expect, it } from "vitest";
import { RuntimeAdapterManifestSchema } from "./RuntimeAdapterManifestSchema";

describe("RuntimeAdapterManifestSchema", () => {
  it("keeps runtime-specific capability truth without pretending every CLI streams tokens", () => {
    const manifest = {
      runtime: "codex",
      displayName: "Codex CLI",
      supportLevel: "supported",
      binaries: ["codex"],
      versionArgs: ["--version"],
      streamFormat: "codex-jsonl",
      capabilities: {
        textStreaming: "message",
        thinking: false,
        toolEvents: true,
        usage: true,
        cancellation: "signal",
        resume: "session",
        mcpInjection: "config",
        imageInput: true,
      },
    } as const;

    expect(RuntimeAdapterManifestSchema.parse(manifest)).toEqual(manifest);
  });

  it("rejects an empty binary catalog", () => {
    expect(
      RuntimeAdapterManifestSchema.safeParse({
        runtime: "codex",
        displayName: "Codex CLI",
        supportLevel: "supported",
        binaries: [],
        versionArgs: [],
        streamFormat: "codex-jsonl",
        capabilities: {
          textStreaming: "message",
          thinking: false,
          toolEvents: true,
          usage: true,
          cancellation: "signal",
          resume: "session",
          mcpInjection: "config",
          imageInput: true,
        },
      }).success,
    ).toBe(false);
  });
});

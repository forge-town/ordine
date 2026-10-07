import { describe, expect, it } from "vitest";
import { resolveRuntimeExecutable } from "../..";

describe("Agent Run persistence boundary", () => {
  it("falls back from an unreadable persisted runtime path to the freshly detected executable", async () => {
    const configuredPath =
      process.platform === "win32"
        ? "C:\\Program Files\\WindowsApps\\OpenAI.Codex\\codex.exe"
        : "/opt/stale/codex";
    const detectedPath =
      process.platform === "win32"
        ? "C:\\Users\\tester\\AppData\\Roaming\\npm\\codex.cmd"
        : "/usr/local/bin/codex";
    const resolution = await resolveRuntimeExecutable({
      runtime: "codex",
      configuredPath,
      configuredVersion: "stale",
      detectedPath,
      detectedVersion: "current",
      readExecutable: async (path) => {
        if (path === configuredPath) throw new Error("EPERM");

        return new TextEncoder().encode("@openai/codex shim");
      },
      probeCapabilities: async ({ path }) => ({
        structuredOutput: path === detectedPath,
        partialMessages: false,
        resume: path === detectedPath,
        sessionId: false,
        skipPermissions: false,
        reasoningEffort: true,
        variant: false,
        autoPermissions: false,
      }),
    });

    expect(resolution.path).toBe(detectedPath);
    expect(resolution.version).toBe("current");
    expect(resolution.fingerprint).toMatch(/^[a-f\d]{64}$/);
    expect(resolution.resolutionWarning).toContain("freshly detected PATH executable");
  });
});

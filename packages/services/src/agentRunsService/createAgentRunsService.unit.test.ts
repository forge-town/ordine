import { describe, expect, it } from "vitest";
import {
  commitAgentRunEventBeforeBroadcast,
  resolveRuntimeExecutable,
} from "./createAgentRunsService";
import { redactSensitiveText, sanitizeRuntimeEvent } from "./sanitizeAgentRunData";

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

  it("commits an event before any listener can observe it", async () => {
    const order: string[] = [];
    const result = await commitAgentRunEventBeforeBroadcast(
      async () => {
        order.push("committed");

        return { sequence: 9 };
      },
      async (event) => {
        expect(event.sequence).toBe(9);
        order.push("broadcast");
      },
    );

    expect(result).toEqual({ sequence: 9 });
    expect(order).toEqual(["committed", "broadcast"]);
  });

  it("redacts credentials and marks oversized runtime events before storage", () => {
    const standaloneKey = "sk-abcdefghijklmnop";
    expect(redactSensitiveText("Authorization: Bearer secret-token-value")).not.toContain(
      "secret-token-value",
    );
    expect(redactSensitiveText(`credential ${standaloneKey}`)).toBe("credential sk-[REDACTED]");
    expect(redactSensitiveText("github ghp_abcdefghijklmnopqrstuvwxyz123456")).not.toContain(
      "abcdefghijklmnopqrstuvwxyz123456",
    );
    const terminal = sanitizeRuntimeEvent({
      type: "terminal",
      runtime: "codex",
      timestamp: "2026-08-22T00:00:00.000Z",
      status: "failed",
      exitCode: 1,
      signal: null,
      resultText: `provider rejected ${standaloneKey}`,
    });
    expect(JSON.stringify(terminal)).not.toContain(standaloneKey);
    const event = sanitizeRuntimeEvent({
      type: "tool_result",
      runtime: "codex",
      timestamp: "2026-08-22T00:00:00.000Z",
      id: "tool-1",
      isError: false,
      output: "x".repeat(200_000),
    });
    expect(event.type).toBe("tool_result");
    expect(JSON.stringify(event)).toMatch(/truncated/i);
  });
});

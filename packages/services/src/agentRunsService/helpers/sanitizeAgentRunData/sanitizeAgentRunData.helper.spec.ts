import { describe, expect, it } from "vitest";

import { redactSensitiveText, sanitizeRuntimeEvent } from "./sanitizeAgentRunData.helper";

describe("Agent Run persistence boundary", () => {
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

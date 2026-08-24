import { describe, expect, it } from "vitest";
import { commitAgentRunEventBeforeBroadcast } from "./createAgentRunsService";
import { redactSensitiveText, sanitizeRuntimeEvent } from "./sanitizeAgentRunData";

describe("Agent Run persistence boundary", () => {
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

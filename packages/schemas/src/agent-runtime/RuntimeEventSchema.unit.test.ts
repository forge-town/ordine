import { describe, expect, it } from "vitest";
import { RuntimeEventSchema, RuntimeExecutionResultSchema } from "./RuntimeEventSchema";

const timestamp = "2026-08-21T08:00:00.000Z";

describe("RuntimeEventSchema", () => {
  it("represents message-granularity output separately from text deltas", () => {
    expect(
      RuntimeEventSchema.parse({
        runtime: "codex",
        timestamp,
        type: "message",
        text: "A complete Codex agent message",
      }),
    ).toEqual({
      runtime: "codex",
      timestamp,
      type: "message",
      text: "A complete Codex agent message",
    });
  });

  it("requires terminal truth in an execution result", () => {
    const terminal = {
      runtime: "hermes",
      timestamp,
      type: "terminal",
      status: "completed",
      exitCode: 0,
      resultText: "done",
    } as const;

    expect(
      RuntimeExecutionResultSchema.parse({ text: "done", terminal, events: [terminal] }),
    ).toEqual({ text: "done", terminal, events: [terminal] });
  });

  it("represents durable sessions and permission decisions explicitly", () => {
    expect(
      RuntimeEventSchema.parse({
        runtime: "deepseek-reasonix",
        timestamp,
        type: "session",
        phase: "loaded",
        id: "session-42",
      }),
    ).toMatchObject({ type: "session", phase: "loaded", id: "session-42" });

    expect(
      RuntimeEventSchema.parse({
        runtime: "kiro",
        timestamp,
        type: "permission",
        requestId: 7,
        toolCallId: "tool-1",
        options: [{ id: "allow", kind: "allow_once" }],
        outcome: "selected",
        selectedOptionId: "allow",
      }),
    ).toMatchObject({ type: "permission", outcome: "selected" });
  });
});

import { describe, expect, it } from "vitest";
import { createInitialAgentRunActivitySnapshot, type AgentRunEventEnvelope } from "@repo/schemas";
import { reduceAgentRunActivity, reduceAgentRunActivityEvents } from "./reducer";

const envelope = (
  sequence: number,
  event: AgentRunEventEnvelope["event"],
): AgentRunEventEnvelope => ({
  runId: "run-1",
  sequence,
  createdAt: `2026-08-27T00:00:${String(sequence).padStart(2, "0")}.000Z`,
  event,
});

describe("Agent Run activity reducer", () => {
  it("accepts opaque non-contiguous cursors and is idempotent", () => {
    const initial = createInitialAgentRunActivitySnapshot("run-1", "codex");
    const first = reduceAgentRunActivity(
      initial,
      envelope(7, {
        type: "status",
        runtime: "codex",
        timestamp: "2026-08-27T00:00:07.000Z",
        phase: "running",
      }),
    );
    const second = reduceAgentRunActivity(
      first.snapshot,
      envelope(11, {
        type: "text_delta",
        runtime: "codex",
        timestamp: "2026-08-27T00:00:11.000Z",
        text: "hello",
      }),
    );
    const duplicate = reduceAgentRunActivity(
      second.snapshot,
      envelope(11, {
        type: "text_delta",
        runtime: "codex",
        timestamp: "2026-08-27T00:00:11.000Z",
        text: "hello",
      }),
    );

    expect(second.accepted).toBe(true);
    expect(second.snapshot.latestSequence).toBe(11);
    expect(second.snapshot.content).toBe("hello");
    expect(duplicate.accepted).toBe(false);
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.snapshot.content).toBe("hello");
  });

  it("projects tools and artifacts without exposing thinking deltas", () => {
    const snapshot = reduceAgentRunActivityEvents("run-1", "claude-code", [
      envelope(2, {
        type: "thinking_delta",
        runtime: "claude-code",
        timestamp: "2026-08-27T00:00:02.000Z",
        text: "private reasoning",
      }),
      envelope(5, {
        type: "tool_start",
        runtime: "claude-code",
        timestamp: "2026-08-27T00:00:05.000Z",
        id: "tool-1",
        name: "Read",
      }),
      envelope(8, {
        type: "tool_result",
        runtime: "claude-code",
        timestamp: "2026-08-27T00:00:08.000Z",
        id: "tool-1",
        isError: false,
        output: "secret output is not projected",
      }),
      envelope(13, {
        type: "artifact",
        runtime: "claude-code",
        timestamp: "2026-08-27T00:00:13.000Z",
        path: "C:\\workspace\\report.md",
        mediaType: "text/markdown",
      }),
    ]);

    expect(snapshot.phase).toBe("tool");
    expect(snapshot.content).not.toContain("private reasoning");
    expect(snapshot.activeTools).toHaveLength(0);
    expect(snapshot.completedTools[0]?.name).toBe("Read");
    expect(snapshot.artifacts[0]).toMatchObject({
      label: "report.md",
      contentType: "text/markdown",
      localPath: "C:\\workspace\\report.md",
      remotePath: null,
      openModes: ["open", "copy_path"],
    });
  });

  it("keeps a terminal projection monotonic", () => {
    const initial = createInitialAgentRunActivitySnapshot("run-1", "codex");
    const terminal = reduceAgentRunActivity(
      initial,
      envelope(3, {
        type: "terminal",
        runtime: "codex",
        timestamp: "2026-08-27T00:00:03.000Z",
        status: "completed",
        exitCode: 0,
        signal: null,
        resultText: "done",
      }),
    );
    const late = reduceAgentRunActivity(
      terminal.snapshot,
      envelope(8, {
        type: "text_delta",
        runtime: "codex",
        timestamp: "2026-08-27T00:00:08.000Z",
        text: "late output",
      }),
    );

    expect(terminal.snapshot.status).toBe("completed");
    expect(late.accepted).toBe(false);
    expect(late.duplicate).toBe(false);
    expect(late.snapshot.content).toBe("done");
  });
});

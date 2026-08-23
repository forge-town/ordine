import { describe, expect, it } from "vitest";
import { appendAgentActivity, runtimeEventToAgentActivity } from "./agentActivity";

const timestamp = (seconds: number) => `2026-08-24T00:00:${String(seconds).padStart(2, "0")}.000Z`;

describe("agent activity projection", () => {
  it("retains separate reasoning spans around tool activity", () => {
    const events = [
      {
        type: "thinking_delta" as const,
        runtime: "codex" as const,
        timestamp: timestamp(1),
        text: "Inspecting ",
      },
      {
        type: "thinking_delta" as const,
        runtime: "codex" as const,
        timestamp: timestamp(2),
        text: "the workspace",
      },
      {
        type: "tool_start" as const,
        runtime: "codex" as const,
        timestamp: timestamp(3),
        id: "tool-1",
        name: "read_file",
      },
      {
        type: "thinking_delta" as const,
        runtime: "codex" as const,
        timestamp: timestamp(4),
        text: "Preparing the answer",
      },
    ];

    const activities = events.reduce(
      (current, event) => appendAgentActivity(current, runtimeEventToAgentActivity(event)),
      [] as ReturnType<typeof runtimeEventToAgentActivity>[],
    );

    expect(activities).toHaveLength(3);
    expect(activities[0]).toMatchObject({
      kind: "thinking",
      detail: "Inspecting the workspace",
    });
    expect(activities[1]).toMatchObject({ kind: "tool", title: "read_file" });
    expect(activities[2]).toMatchObject({
      kind: "thinking",
      detail: "Preparing the answer",
    });
    expect(new Set(activities.map((entry) => entry.id)).size).toBe(3);
  });

  it("updates a tool row through its lifecycle without erasing prior activity", () => {
    const started = runtimeEventToAgentActivity({
      type: "tool_start",
      runtime: "opencode",
      timestamp: timestamp(1),
      id: "tool-1",
      name: "write",
      input: { path: "paper.md" },
    });
    const completed = runtimeEventToAgentActivity({
      type: "tool_result",
      runtime: "opencode",
      timestamp: timestamp(2),
      id: "tool-1",
      isError: false,
      output: "saved",
    });

    expect(appendAgentActivity([started], completed)).toEqual([
      expect.objectContaining({ title: "tool-1 · completed", detail: "saved" }),
    ]);
  });
});

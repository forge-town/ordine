import { describe, expect, it } from "vitest";
import { buildRunTimeline, summarizeMultiInputNodes } from "./runTraceParser";

describe("runTraceParser", () => {
  it("builds node timeline, current step, and artifacts from run traces", () => {
    const result = buildRunTimeline([
      { message: "[2026-04-08T16:00:00.000Z] @@NODE_START::folder-input" },
      { message: "[2026-04-08T16:00:01.000Z] @@NODE_DONE::folder-input" },
      { message: "[2026-04-08T16:00:02.000Z] @@NODE_START::review-op" },
      { message: '[2026-04-08T16:00:03.000Z] Executing operation "Review code" (agent)' },
      {
        message:
          "[2026-04-08T16:00:04.000Z] Wrote output to: C:\\tmp\\ordine-output\\review-report.md (120 chars)",
      },
    ]);

    expect(result.timeline).toEqual([
      expect.objectContaining({ nodeId: "folder-input", status: "done" }),
      expect.objectContaining({ nodeId: "review-op", status: "running" }),
    ]);
    expect(result.currentNodeId).toBe("review-op");
    expect(result.latestProgressMessage).toBe('Executing operation "Review code" (agent)');
    expect(result.artifacts).toEqual([
      expect.objectContaining({ path: "C:\\tmp\\ordine-output\\review-report.md" }),
    ]);
  });

  it("summarizes nodes that wait for multiple parent inputs", () => {
    const summary = summarizeMultiInputNodes([
      { source: "file-a", target: "merge-op" },
      { source: "file-b", target: "merge-op" },
      { source: "merge-op", target: "output" },
    ]);

    expect(summary.count).toBe(1);
    expect(summary.nodeIds).toEqual(["merge-op"]);
  });

  it("keeps a running node visible when parallel work is still active", () => {
    const result = buildRunTimeline([
      { message: "[2026-04-08T16:00:00.000Z] @@NODE_START::scan-a" },
      { message: "[2026-04-08T16:00:01.000Z] @@NODE_START::scan-b" },
      { message: "[2026-04-08T16:00:02.000Z] @@NODE_DONE::scan-b" },
    ]);

    expect(result.timeline).toEqual([
      expect.objectContaining({ nodeId: "scan-a", status: "running" }),
      expect.objectContaining({ nodeId: "scan-b", status: "done" }),
    ]);
    expect(result.currentNodeId).toBe("scan-a");
  });

  it("parses newest-first traces in chronological order when timestamps are available", () => {
    const result = buildRunTimeline([
      {
        createdAt: "2026-04-08T16:00:03.000Z",
        message: "Executing operation",
      },
      {
        createdAt: "2026-04-08T16:00:02.000Z",
        message: "@@NODE_START::review-op",
      },
      {
        createdAt: "2026-04-08T16:00:01.000Z",
        message: "@@NODE_DONE::folder-input",
      },
      {
        createdAt: "2026-04-08T16:00:00.000Z",
        message: "@@NODE_START::folder-input",
      },
    ]);

    expect(result.timeline).toEqual([
      expect.objectContaining({ nodeId: "folder-input", status: "done" }),
      expect.objectContaining({ nodeId: "review-op", status: "running" }),
    ]);
    expect(result.currentNodeId).toBe("review-op");
    expect(result.latestProgressMessage).toBe("Executing operation");
  });
});

import { describe, expect, it } from "vitest";
import { AgentRunRequestSchema, AgentRunSchema } from "./AgentRunSchema";

describe("AgentRunSchema", () => {
  it("defaults local execution to full access while allowing explicit downscoping", () => {
    const request = AgentRunRequestSchema.parse({
      owner: { type: "pipeline-agent-session", id: "session-1" },
      runtimeConfigId: "local-codex",
      cwd: "C:\\repo",
      prompt: "Run the task",
      rebuildPrompt: "Run the task",
    });

    expect(request.permissionMode).toBe("full-access");
    expect(request.fullAccessConfirmed).toBe(true);
    expect(
      AgentRunRequestSchema.parse({
        ...request,
        permissionMode: "workspace-write",
        fullAccessConfirmed: false,
      }).permissionMode,
    ).toBe("workspace-write");
  });

  it("defaults execution choices for runs stored before the fields existed", () => {
    const run = AgentRunSchema.parse({
      id: "run-1",
      owner: { type: "pipeline-agent-session", id: "session-1" },
      runtimeConfigId: "local-codex",
      runtime: "codex",
      status: "completed",
      executablePath: "C:\\bin\\codex.exe",
      executableVersion: "1.0.0",
      executableFingerprint: "hash",
      model: null,
      cwd: "C:\\repo",
      nativeSessionId: null,
      resumeFromRunId: null,
      permissionMode: "workspace-write",
      networkAccess: true,
      usage: null,
      resultText: "done",
      errorCode: null,
      errorMessage: null,
      createdAt: "2026-08-22T00:00:00.000Z",
      startedAt: "2026-08-22T00:00:00.000Z",
      firstOutputAt: "2026-08-22T00:00:01.000Z",
      lastActivityAt: "2026-08-22T00:00:01.000Z",
      finishedAt: "2026-08-22T00:00:02.000Z",
    });

    expect(run.reasoningEffort).toBeNull();
    expect(run.speed).toBeNull();
    expect(run.controlMode).toBe(false);
    expect(run.allowedTools).toEqual([]);
    expect(run.controlScopes).toEqual([]);
  });

  it("requires explicit MCP-only downscoping for control mode", () => {
    const base = {
      owner: { type: "agent-thread", id: "thread-1" },
      runtimeConfigId: "local-claude-code",
      cwd: "C:\\empty-control-dir",
      prompt: "Use ORDINE tools",
      rebuildPrompt: "Use ORDINE tools",
      controlMode: true,
      controlScopes: ["resources:read" as const],
    };

    expect(() => AgentRunRequestSchema.parse({ ...base, allowedTools: ["ordine.search"] })).toThrow(
      /read-only/,
    );
    expect(() =>
      AgentRunRequestSchema.parse({ ...base, permissionMode: "read-only", allowedTools: [] }),
    ).toThrow(/allowlist/);
    expect(
      AgentRunRequestSchema.parse({
        ...base,
        permissionMode: "read-only",
        fullAccessConfirmed: false,
        allowedTools: ["ordine.search"],
      }).controlMode,
    ).toBe(true);
  });
});

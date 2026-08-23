import { describe, expect, it, vi } from "vitest";
import type { AgentRunEventEnvelope } from "@repo/schemas";
import { createAgentRunController } from "./createAgentRunController";
import type { createAgentRunsService } from "./createAgentRunsService";

const envelope = (
  sequence: number,
  event: AgentRunEventEnvelope["event"],
): AgentRunEventEnvelope => ({
  runId: "run-1",
  sequence,
  createdAt: "2026-08-22T00:00:00.000Z",
  event,
});

describe("createAgentRunController", () => {
  it("routes Codex through a persistent run and replays callbacks once", async () => {
    const events = [
      envelope(1, {
        type: "message",
        runtime: "codex",
        timestamp: "2026-08-22T00:00:00.000Z",
        text: "done",
      }),
      envelope(2, {
        type: "usage",
        runtime: "codex",
        timestamp: "2026-08-22T00:00:01.000Z",
        inputTokens: 3,
        outputTokens: 1,
      }),
      envelope(3, {
        type: "terminal",
        runtime: "codex",
        timestamp: "2026-08-22T00:00:02.000Z",
        status: "completed",
      }),
    ];
    const service = {
      start: vi.fn().mockResolvedValue({ runId: "run-1" }),
      subscribe: vi.fn().mockReturnValue(() => undefined),
      getEvents: vi
        .fn()
        .mockImplementation((_runId: string, after: number) =>
          Promise.resolve(events.filter((item) => item.sequence > after)),
        ),
      wait: vi.fn().mockResolvedValue({
        status: "completed",
        resultText: "done",
        usage: { inputTokens: 3, outputTokens: 1 },
      }),
      cancel: vi.fn(),
    } as unknown as ReturnType<typeof createAgentRunsService>;
    const onRuntimeEvent = vi.fn();
    const onTextDelta = vi.fn();
    const onAgentRunStarted = vi.fn();
    const result = await createAgentRunController(service)({
      agent: "codex",
      mode: "direct",
      systemPrompt: "system",
      userPrompt: "prompt",
      cwd: "C:\\workspace",
      jobId: "job-1",
      agentId: "agent-1",
      firstOutputTimeoutMs: 180_000,
      onRuntimeEvent,
      onTextDelta,
      onAgentRunStarted,
    });

    expect(service.start).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: { type: "job-agent", id: "job-1:agent-1" },
        runtimeConfigId: "local-codex",
        permissionMode: "full-access",
        networkAccess: true,
        fullAccessConfirmed: true,
        firstOutputTimeoutMs: 180_000,
      }),
      expect.any(Object),
    );
    expect(onTextDelta).toHaveBeenCalledOnce();
    expect(onAgentRunStarted).toHaveBeenCalledOnce();
    expect(onAgentRunStarted).toHaveBeenCalledWith("run-1");
    expect(onAgentRunStarted.mock.invocationCallOrder[0]).toBeLessThan(
      onRuntimeEvent.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER,
    );
    expect(onRuntimeEvent).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ text: "done", usage: { input: 3, output: 1 } });
  });

  it("cancels a started run when its durable node mapping cannot be recorded", async () => {
    const service = {
      start: vi.fn().mockResolvedValue({ runId: "run-1" }),
      cancel: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn(),
    } as unknown as ReturnType<typeof createAgentRunsService>;

    await expect(
      createAgentRunController(service)({
        agent: "codex",
        mode: "direct",
        systemPrompt: "system",
        userPrompt: "prompt",
        cwd: "C:\\workspace",
        onAgentRunStarted: async () => {
          throw new Error("trace write failed");
        },
      }),
    ).rejects.toThrow("trace write failed");

    expect(service.cancel).toHaveBeenCalledWith("run-1");
    expect(service.subscribe).not.toHaveBeenCalled();
  });
});

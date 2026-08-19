import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  runClaude,
  runCodex,
  runHermes,
  runKimiCode,
  runMastra,
  type ClaudeStreamEvent,
} from "@repo/agent";

const fakeClaudeEvents: ClaudeStreamEvent[] = [
  {
    type: "result",
    subtype: "success",
    duration_ms: 1000,
    total_cost_usd: 0.01,
    num_turns: 1,
  },
];

vi.mock("@repo/agent", () => ({
  hasMcpConnectorInjection: (injection?: { mcpServers?: Record<string, unknown> } | null) =>
    !!injection && Object.keys(injection.mcpServers ?? {}).length > 0,
  runClaude: vi.fn(async (opts: { onProgress?: (s: string) => Promise<void> }) => {
    await opts.onProgress?.("progress");

    return { text: "fake claude output", events: fakeClaudeEvents };
  }),
  runCodex: vi.fn(
    async (opts: {
      onProgress?: (s: string) => Promise<void>;
      onTextDelta?: (s: string) => Promise<void>;
    }) => {
    await opts.onProgress?.("progress");
    await opts.onTextDelta?.("partial codex output");

    return "fake codex output";
    },
  ),
  runHermes: vi.fn(async (opts: { onProgress?: (s: string) => Promise<void> }) => {
    await opts.onProgress?.("progress");

    return {
      isErr: () => false,
      value: "fake hermes output",
    };
  }),
  runMastra: vi.fn(async (opts: { onProgress?: (s: string) => Promise<void> }) => {
    await opts.onProgress?.("progress");

    return { text: "fake mastra output", events: [] };
  }),
  runKimiCode: vi.fn(async (opts: { onProgress?: (s: string) => Promise<void> }) => {
    await opts.onProgress?.("progress");

    return {
      isErr: () => false,
      value: "fake kimi output",
    };
  }),
  runOpenclaw: vi.fn(async (opts: { onProgress?: (s: string) => Promise<void> }) => {
    await opts.onProgress?.("progress");

    return { text: "fake openclaw output" };
  }),
}));

vi.mock("@repo/obs", () => ({
  recordAgentRunWithSpans: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@repo/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { agentEngine } from "./agentEngine";
import { recordAgentRunWithSpans } from "@repo/obs";

describe("agentEngine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dispatches to runClaude for claude-code", async () => {
    const result = await agentEngine.run({
      agent: "claude-code",
      mode: "direct",
      systemPrompt: "You are a linter",
      userPrompt: "Check this code",
      cwd: "/tmp/test",
      allowedTools: ["Read"],
    });

    expect(result.text).toBe("fake claude output");
    // The fake result event carries no modelUsage → usage is unavailable (null),
    // never a fabricated 0. (See the modelUsage tests below for reported totals.)
    expect(result.usage).toBeNull();
  });

  it("writes claude mcp config for connector injection", async () => {
    await agentEngine.run({
      agent: "claude-code",
      mode: "direct",
      systemPrompt: "You can publish",
      userPrompt: "Publish this project",
      cwd: "/tmp/test",
      allowedTools: ["Read"],
      connectorInjection: {
        mcpServers: {
          GitHub: { command: "github-mcp" },
        },
        toolNames: ["mcp__GitHub__create_issue"],
      },
    });

    expect(runClaude).toHaveBeenCalledWith(
      expect.objectContaining({
        allowedTools: ["Read"],
        mcpToolNames: ["mcp__GitHub__create_issue"],
        mcpConfigPath: expect.stringContaining("ordine-claude-mcp-"),
      }),
    );
  });

  it("derives usage totals when the claude result event reports modelUsage", async () => {
    vi.mocked(runClaude).mockResolvedValueOnce({
      text: "with usage",
      events: [
        {
          type: "result",
          subtype: "success",
          duration_ms: 1000,
          total_cost_usd: 0.02,
          num_turns: 1,
          modelUsage: { "claude-sonnet": { inputTokens: 120, outputTokens: 45 } },
        },
      ],
    });

    const result = await agentEngine.run({
      agent: "claude-code",
      mode: "direct",
      systemPrompt: "s",
      userPrompt: "u",
      cwd: "/tmp",
    });

    expect(result.usage).toEqual({ input: 120, output: 45 });
  });

  it("preserves an explicitly reported zero usage into observability (not null)", async () => {
    vi.mocked(runClaude).mockResolvedValueOnce({
      text: "zero usage",
      events: [
        {
          type: "result",
          subtype: "success",
          duration_ms: 1000,
          total_cost_usd: 0,
          num_turns: 1,
          modelUsage: { "claude-sonnet": { inputTokens: 0, outputTokens: 0 } },
        },
      ],
    });

    const result = await agentEngine.run({
      agent: "claude-code",
      mode: "direct",
      systemPrompt: "s",
      userPrompt: "u",
      cwd: "/tmp",
      jobId: "job-zero",
      agentId: "agent-zero",
    });

    expect(result.usage).toEqual({ input: 0, output: 0 });
    expect(recordAgentRunWithSpans).toHaveBeenCalledWith(
      expect.objectContaining({ tokenInput: 0, tokenOutput: 0 }),
      expect.any(Function),
    );
  });

  it("dispatches to runCodex for codex", async () => {
    const result = await agentEngine.run({
      agent: "codex",
      mode: "direct",
      systemPrompt: "Analyze this",
      userPrompt: "Hello",
      cwd: "/tmp/test",
      connectorInjection: {
        mcpServers: { linear: { type: "http", url: "https://mcp.linear.app/mcp" } },
        toolNames: ["mcp__linear"],
      },
    });

    expect(result.text).toBe("fake codex output");
    // Non-claude runtimes have no event stream → usage is unavailable (null), not a fake 0.
    expect(result.usage).toBeNull();
    expect(runCodex).toHaveBeenCalledWith(
      expect.objectContaining({
        connectorInjection: {
          mcpServers: { linear: { type: "http", url: "https://mcp.linear.app/mcp" } },
          toolNames: ["mcp__linear"],
        },
      }),
    );
  });

  it("forwards Codex text deltas to the caller", async () => {
    const onTextDelta = vi.fn();

    await agentEngine.run({
      agent: "codex",
      mode: "direct",
      systemPrompt: "Analyze this",
      userPrompt: "Hello",
      cwd: "/tmp/test",
      onTextDelta,
    });

    expect(onTextDelta).toHaveBeenCalledWith("partial codex output");
  });

  it("loads only the selected connector tools inside a supported adapter", async () => {
    const stableMcpReference = "mcp__connector_676974687562__read_issue";
    const injection = {
      mcpServers: { connector_676974687562: { command: "github-mcp" } },
      toolNames: [stableMcpReference],
    };
    const getMcpConnectorInjection = vi.fn().mockResolvedValue(injection);

    await agentEngine.run({
      agent: "codex",
      mode: "direct",
      systemPrompt: "Analyze this",
      userPrompt: "Hello",
      cwd: "/tmp/test",
      allowedTools: ["Read", stableMcpReference],
      getMcpConnectorInjection,
    });

    expect(getMcpConnectorInjection).toHaveBeenCalledWith([stableMcpReference], "codex");
    expect(runCodex).toHaveBeenCalledWith(
      expect.objectContaining({ connectorInjection: injection }),
    );
  });

  it("loads only the selected connector for Kimi", async () => {
    const stableMcpReference = "mcp__connector_676974687562__read_issue";
    const injection = {
      mcpServers: { connector_676974687562: { command: "github-mcp" } },
      toolNames: [stableMcpReference],
    };
    const getMcpConnectorInjection = vi.fn().mockResolvedValue(injection);

    const result = await agentEngine.run({
      agent: "kimi-code",
      mode: "direct",
      systemPrompt: "Analyze this",
      userPrompt: "Hello",
      cwd: "/tmp/test",
      allowedTools: ["Read", stableMcpReference],
      getMcpConnectorInjection,
    });

    expect(result.text).toBe("fake kimi output");
    expect(getMcpConnectorInjection).toHaveBeenCalledWith([stableMcpReference], "kimi-code");
    expect(runKimiCode).toHaveBeenCalledWith(
      expect.objectContaining({ connectorInjection: injection }),
    );
  });

  it("rejects Codex SSH runtimes before resolving connector credentials", async () => {
    const getMcpConnectorInjection = vi.fn();
    const onProgress = vi.fn();

    await expect(
      agentEngine.run({
        agent: "codex",
        mode: "direct",
        systemPrompt: "Analyze this",
        userPrompt: "Hello",
        cwd: "/tmp/test",
        ssh: { host: "remote.example.com", user: "runner" },
        allowedTools: ["mcp__github__read_issue"],
        getMcpConnectorInjection,
        onProgress,
      }),
    ).rejects.toThrow("Codex SSH runtime is not supported yet");

    expect(getMcpConnectorInjection).not.toHaveBeenCalled();
    expect(runCodex).not.toHaveBeenCalled();
    expect(onProgress).toHaveBeenCalledWith(expect.stringContaining("codex skipped"));
  });

  it("does not resolve connector credentials for unsupported runtimes", async () => {
    const getMcpConnectorInjection = vi.fn();
    const onProgress = vi.fn();

    await agentEngine.run({
      agent: "mastra",
      mode: "direct",
      systemPrompt: "Analyze this",
      userPrompt: "Hello",
      cwd: "/tmp/test",
      allowedTools: ["mcp__github__read_issue"],
      getMcpConnectorInjection,
      onProgress,
    });

    expect(getMcpConnectorInjection).not.toHaveBeenCalled();
    expect(onProgress).toHaveBeenCalledWith(expect.stringContaining("mastra skipped"));
  });

  it("dispatches to runHermes without overriding its locally configured model", async () => {
    const result = await agentEngine.run({
      agent: "hermes",
      mode: "direct",
      systemPrompt: "Analyze this",
      userPrompt: "Hello",
      cwd: "/tmp/test",
      model: "nous-hermes-4",
      allowedTools: ["WebSearch"],
    });

    expect(result.text).toBe("fake hermes output");
    expect(result.usage).toBeNull();
    expect(runHermes).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: "/tmp/test",
        allowedTools: ["WebSearch"],
        systemPrompt: "Analyze this",
        userPrompt: "Hello",
      }),
    );
    expect(runHermes).not.toHaveBeenCalledWith(
      expect.objectContaining({ model: expect.anything() }),
    );
  });

  it("forwards image attachments to the selected runtime", async () => {
    await agentEngine.run({
      agent: "mastra",
      mode: "direct",
      systemPrompt: "system",
      userPrompt: "describe the screenshot",
      cwd: "/tmp/test",
      attachments: [
        {
          kind: "image",
          filename: "ui.png",
          mediaType: "image/png",
          dataBase64: "ZmFrZQ==",
        },
      ],
    });

    expect(runMastra).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [
          expect.objectContaining({
            kind: "image",
            filename: "ui.png",
          }),
        ],
      }),
    );
  });

  it("rejects image attachments for runtimes without vision support", async () => {
    await expect(
      agentEngine.run({
        agent: "codex",
        mode: "direct",
        systemPrompt: "system",
        userPrompt: "describe the screenshot",
        cwd: "/tmp/test",
        attachments: [
          {
            kind: "image",
            filename: "ui.png",
            mediaType: "image/png",
            dataBase64: "ZmFrZQ==",
          },
        ],
      }),
    ).rejects.toThrow("does not support image attachments");
  });

  it("throws for unsupported agent backend", async () => {
    await expect(
      agentEngine.run({
        agent: "unknown" as "claude-code",
        mode: "direct",
        systemPrompt: "x",
        userPrompt: "y",
        cwd: "/tmp",
      }),
    ).rejects.toThrow("Unsupported agent backend");
  });

  it("forwards onProgress to the underlying driver", async () => {
    const onProgress = vi.fn();

    await agentEngine.run({
      agent: "claude-code",
      mode: "direct",
      systemPrompt: "x",
      userPrompt: "y",
      cwd: "/tmp",
      onProgress,
    });

    expect(onProgress).toHaveBeenCalled();
  });

  it("records observability when jobId and agentId are provided", async () => {
    await agentEngine.run({
      agent: "claude-code",
      mode: "direct",
      systemPrompt: "sys",
      userPrompt: "user",
      cwd: "/tmp",
      jobId: "job-1",
      agentId: "test-agent",
    });

    expect(recordAgentRunWithSpans).toHaveBeenCalledOnce();
    expect(recordAgentRunWithSpans).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-1",
        agentRuntime: "claude-code",
        agentId: "test-agent",
        rawPayload: expect.objectContaining({
          system: "sys",
          prompt: "user",
          output: "fake claude output",
        }),
        // Default fake has no modelUsage → tokens recorded as null (unavailable),
        // not 0.
        tokenInput: null,
        tokenOutput: null,
        status: "completed",
      }),
      expect.any(Function),
    );
  });

  it("records hermes observability with empty event spans", async () => {
    await agentEngine.run({
      agent: "hermes",
      mode: "direct",
      systemPrompt: "sys",
      userPrompt: "user",
      cwd: "/tmp",
      jobId: "job-1",
      agentId: "hermes-agent",
    });

    expect(recordAgentRunWithSpans).toHaveBeenCalledOnce();
    expect(recordAgentRunWithSpans).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-1",
        agentRuntime: "hermes",
        agentId: "hermes-agent",
        rawPayload: expect.objectContaining({
          system: "sys",
          prompt: "user",
          output: "fake hermes output",
        }),
      }),
      expect.any(Function),
    );

    const buildSpans = vi.mocked(recordAgentRunWithSpans).mock.calls[0]![1];
    expect(buildSpans(123)).toEqual([
      expect.objectContaining({
        rawExportId: 123,
        spanType: "agent_run",
        name: "hermes-agent",
        output: "fake hermes output",
        status: "completed",
      }),
    ]);
  });

  it("skips observability when jobId or agentId is missing", async () => {
    await agentEngine.run({
      agent: "claude-code",
      mode: "direct",
      systemPrompt: "x",
      userPrompt: "y",
      cwd: "/tmp",
    });

    expect(recordAgentRunWithSpans).not.toHaveBeenCalled();
  });
});

import { okAsync } from "neverthrow";
import { describe, expect, it, vi } from "vitest";

const runConfiguredAcpAgentMock = vi.fn((_config: unknown, _options: unknown) => okAsync("done"));

vi.mock("../runtime/runConfiguredAcpAgent", () => ({
  runConfiguredAcpAgent: (config: unknown, options: unknown) =>
    runConfiguredAcpAgentMock(config, options),
}));

import { runKimiCode } from "./runKimiCode";

describe("runKimiCode", () => {
  it("runs Kimi through ACP and forwards job-scoped MCP servers", async () => {
    const connectorInjection = {
      mcpServers: { github: { command: "github-mcp", args: ["serve"] } },
      toolNames: ["mcp__github__read_issue"],
    };
    const result = await runKimiCode({
      systemPrompt: "system",
      userPrompt: "user",
      cwd: "C:\\workspace",
      connectorInjection,
    });

    expect(result._unsafeUnwrap()).toBe("done");
    expect(runConfiguredAcpAgentMock).toHaveBeenCalledWith(
      expect.objectContaining({ runtime: "kimi-code", command: "kimi", args: ["acp"] }),
      expect.objectContaining({ connectorInjection }),
    );
  });
});

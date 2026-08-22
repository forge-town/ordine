import { ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

const runJsonEventStreamMock = vi.hoisted(() => vi.fn());

vi.mock("../runtime/runJsonEventStream", () => ({
  runJsonEventStream: (...args: unknown[]) => runJsonEventStreamMock(...args),
}));

import {
  buildOpenCodeMcpConfigContent,
  OPENCODE_SKIP_PERMISSIONS_FLAG,
  runOpencode,
} from "./runOpencode";

describe("runOpencode OpenDesign-compatible invocation", () => {
  beforeEach(() => {
    runJsonEventStreamMock.mockReset();
    runJsonEventStreamMock.mockResolvedValue(
      ok({ text: "done", events: [], terminal: {}, sessionId: undefined }),
    );
  });

  it("adds the permission bypass only after the exact help capability was detected", async () => {
    const result = await runOpencode({
      systemPrompt: "system",
      userPrompt: "user",
      cwd: "C:\\workspace",
      executablePath: "C:\\bin\\opencode.exe",
      supportsPermissionBypass: true,
      resumeSessionId: "ses_123",
      model: "provider/model",
    });

    expect(result.isOk()).toBe(true);
    expect(runJsonEventStreamMock).toHaveBeenCalledWith(
      expect.objectContaining({
        command: "C:\\bin\\opencode.exe",
        args: [
          "run",
          "--format",
          "json",
          OPENCODE_SKIP_PERMISSIONS_FLAG,
          "-s",
          "ses_123",
          "-m",
          "provider/model",
        ],
        stdin: "system\n\n---\n\nuser",
      }),
    );
  });

  it("does not synthesize unsupported permission flags", async () => {
    await runOpencode({
      systemPrompt: "",
      userPrompt: "user",
      cwd: "C:\\workspace",
      supportsPermissionBypass: false,
    });

    const options = runJsonEventStreamMock.mock.calls[0]?.[0] as { args: string[] };
    expect(options.args).not.toContain(OPENCODE_SKIP_PERMISSIONS_FLAG);
  });

  it("leaves OPENCODE_CONFIG_CONTENT unset without run-scoped MCP servers", () => {
    expect(buildOpenCodeMcpConfigContent(undefined)).toBeUndefined();
  });

  it("injects only OpenDesign's MCP config shape", () => {
    const content = buildOpenCodeMcpConfigContent({
      mcpServers: {
        ordine: { command: "node", args: ["ordine-mcp.js"], env: { TOKEN_FILE: "token" } },
      },
      toolNames: ["mcp__ordine__list_jobs"],
    });

    expect(JSON.parse(content ?? "{}")).toEqual({
      mcp: {
        ordine: {
          type: "local",
          command: ["node", "ordine-mcp.js"],
          environment: { TOKEN_FILE: "token" },
          enabled: true,
        },
      },
    });
  });
});

import { ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

const runJsonEventStreamMock = vi.hoisted(() => vi.fn());

vi.mock("../runtime/runJsonEventStream", () => ({
  runJsonEventStream: (...args: unknown[]) => runJsonEventStreamMock(...args),
}));

import {
  buildOpenCodeMcpConfigContent,
  buildOpenCodeRunConfigContent,
  runOpencode,
} from "./runOpencode";

describe("runOpencode invocation", () => {
  beforeEach(() => {
    runJsonEventStreamMock.mockReset();
    runJsonEventStreamMock.mockResolvedValue(
      ok({ text: "done", events: [], terminal: {}, sessionId: undefined }),
    );
  });

  it("passes the model variant and a workspace-write policy without dangerous legacy flags", async () => {
    const result = await runOpencode({
      systemPrompt: "system",
      userPrompt: "user",
      cwd: "C:\\workspace",
      executablePath: "C:\\bin\\opencode.exe",
      permissionMode: "workspace-write",
      supportsVariant: true,
      resumeSessionId: "ses_123",
      model: "provider/model",
      reasoningEffort: "high",
    });

    expect(result.isOk()).toBe(true);
    expect(runJsonEventStreamMock).toHaveBeenCalledWith(
      expect.objectContaining({
        command: "C:\\bin\\opencode.exe",
        args: [
          "run",
          "--format",
          "json",
          "-s",
          "ses_123",
          "-m",
          "provider/model",
          "--variant",
          "high",
        ],
        stdin: "system\n\n---\n\nuser",
        env: expect.objectContaining({
          OPENCODE_CONFIG_CONTENT: expect.any(String),
        }),
      }),
    );
    const options = runJsonEventStreamMock.mock.calls[0]?.[0] as {
      args: string[];
      env: Record<string, string>;
    };
    expect(options.args.join(" ")).not.toContain("dangerously-skip-permissions");
    expect(JSON.parse(options.env.OPENCODE_CONFIG_CONTENT ?? "{}")).toMatchObject({
      permission: {
        edit: "allow",
        external_directory: "deny",
        bash: { "git push*": "deny", "rm -rf *": "deny" },
      },
    });
  });

  it("uses --auto for the product default full-access", async () => {
    const result = await runOpencode({
      systemPrompt: "",
      userPrompt: "user",
      cwd: "C:\\workspace",
      supportsAutoPermissions: true,
    });

    expect(result.isOk()).toBe(true);
    expect(runJsonEventStreamMock.mock.calls[0]?.[0]).toMatchObject({
      args: ["run", "--format", "json", "--auto"],
    });
  });

  it("rejects unconfirmed full-access and unsupported variants before spawn", async () => {
    const unconfirmed = await runOpencode({
      systemPrompt: "",
      userPrompt: "user",
      cwd: "C:\\workspace",
      permissionMode: "full-access",
      fullAccessConfirmed: false,
      supportsAutoPermissions: true,
    });
    const unsupportedVariant = await runOpencode({
      systemPrompt: "",
      userPrompt: "user",
      cwd: "C:\\workspace",
      permissionMode: "workspace-write",
      reasoningEffort: "high",
      supportsVariant: false,
    });

    expect(unconfirmed.isErr() ? unconfirmed.error.message : "").toMatch(
      /explicit user confirmation/,
    );
    expect(unsupportedVariant.isErr() ? unsupportedVariant.error.message : "").toMatch(/--variant/);
    expect(runJsonEventStreamMock).not.toHaveBeenCalled();
  });

  it("builds a read-only policy that denies writes, external paths, and network tools", () => {
    expect(JSON.parse(buildOpenCodeRunConfigContent(undefined, "read-only", false))).toMatchObject({
      permission: {
        edit: "deny",
        external_directory: "deny",
        webfetch: "deny",
        websearch: "deny",
        bash: { "*": "deny", "git status*": "allow" },
      },
    });
  });

  it("leaves the legacy MCP-only helper empty without run-scoped servers", () => {
    expect(buildOpenCodeMcpConfigContent(undefined)).toBeUndefined();
  });

  it("merges MCP servers into the run-level permission config", () => {
    const content = buildOpenCodeRunConfigContent(
      {
        mcpServers: {
          ordine: { command: "node", args: ["ordine-mcp.js"], env: { TOKEN_FILE: "token" } },
        },
        toolNames: ["mcp__ordine__list_jobs"],
      },
      "workspace-write",
      true,
    );

    expect(JSON.parse(content)).toMatchObject({
      permission: { external_directory: "deny" },
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

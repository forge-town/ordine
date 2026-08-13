import { describe, expect, it } from "vitest";
import { parseClaudeMcpConfig } from "./parseClaudeMcpConfig";
import { parseCodexMcpConfig } from "./parseCodexMcpConfig";
import { parseCursorMcpConfig } from "./parseCursorMcpConfig";
import { parseHermesMcpConfig } from "./parseHermesMcpConfig";
import { parseKimiMcpConfig } from "./parseKimiMcpConfig";
import { parseOpenclawMcpConfig } from "./parseOpenclawMcpConfig";
import { parseOpencodeMcpConfig } from "./parseOpencodeMcpConfig";

describe("capability MCP parsers", () => {
  it("parses Claude global and workspace declarations separately", () => {
    const raw = JSON.stringify({
      mcpServers: {
        globalFs: { command: "npx", args: ["-y", "server-fs"], env: { TOKEN: "global" } },
      },
      projects: {
        "D:\\repo": {
          mcpServers: {
            projectApi: { type: "http", url: "https://example.com/mcp" },
          },
        },
      },
    });

    const global = parseClaudeMcpConfig(raw, { scope: "global" });
    const workspace = parseClaudeMcpConfig(raw, {
      scope: "workspace",
      workspacePath: "d:/repo/",
    });

    expect(global.isOk() && global.value.servers[0]).toMatchObject({
      nativeName: "globalFs",
      config: { transport: "stdio", command: "npx" },
      credentials: { env: { TOKEN: "global" } },
    });
    expect(workspace.isOk() && workspace.value.servers[0]).toMatchObject({
      nativeName: "projectApi",
      config: { transport: "http", url: "https://example.com/mcp" },
    });
  });

  it("parses Codex stdio, HTTP, and environment-backed headers", () => {
    const result = parseCodexMcpConfig(`
      [mcp_servers.files]
      command = "npx"
      args = ["-y", "server-files"]
      env_vars = ["SHARED_TOKEN"]

      [mcp_servers.files.env]
      LOCAL_TOKEN = "secret"

      [mcp_servers.remote]
      url = "https://example.com/mcp"
      bearer_token_env_var = "REMOTE_TOKEN"

      [mcp_servers.remote.http_headers]
      Accept = "application/json"

      [mcp_servers.remote.env_http_headers]
      X-Api-Key = "API_KEY"
    `);

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value.servers).toHaveLength(2);
    expect(result.value.servers[0]).toMatchObject({
      nativeName: "files",
      config: { transport: "stdio" },
      credentials: { env: { LOCAL_TOKEN: "secret" } },
      credentialReferences: { env: { SHARED_TOKEN: "SHARED_TOKEN" } },
    });
    expect(result.value.servers[1]).toMatchObject({
      nativeName: "remote",
      config: { transport: "http" },
      credentials: { headers: { Accept: "application/json" } },
      credentialReferences: {
        headers: { "X-Api-Key": "API_KEY" },
        bearerTokenEnv: "REMOTE_TOKEN",
      },
    });
  });

  it("parses Cursor and Kimi well-known mcpServers JSON", () => {
    const raw = `{
      // both tools use the well-known mcpServers shape
      mcpServers: {
        browser: { command: "npx", args: ["browser-mcp"], },
      },
    }`;

    const cursor = parseCursorMcpConfig(raw);
    const kimi = parseKimiMcpConfig(raw);

    expect(cursor.isOk() && cursor.value.servers[0]?.nativeName).toBe("browser");
    expect(kimi.isOk() && kimi.value.servers[0]?.nativeName).toBe("browser");
  });

  it("preserves Kimi working directories and camel-case bearer references", () => {
    const result = parseKimiMcpConfig(`{
      mcpServers: {
        local: { command: "node", args: ["server.js"], cwd: "./tools" },
        remote: { url: "https://example.com/mcp", bearerTokenEnvVar: "KIMI_TOKEN" },
        legacy: { transport: "sse", url: "https://example.com/sse" },
      },
    }`);

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value.servers[0]?.config).toMatchObject({ cwd: "./tools" });
    expect(result.value.servers[1]?.credentialReferences).toEqual({
      bearerTokenEnv: "KIMI_TOKEN",
    });
    expect(result.value.diagnostics).toEqual([
      expect.objectContaining({ nativeName: "legacy", code: "invalid-server" }),
    ]);
  });

  it("keeps OpenClaw environment placeholders as references", () => {
    const result = parseOpenclawMcpConfig(`{
      mcp: {
        servers: {
          local: { command: "node", workingDirectory: "./tools", env: { TOKEN: "\${TOKEN}" } },
          remote: { url: "https://example.com/mcp", headers: { Authorization: "Bearer \${API_TOKEN}" } },
        },
      },
    }`);

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value.servers[0]).toMatchObject({
      config: { cwd: "./tools" },
      credentialReferences: { env: { TOKEN: "TOKEN" } },
    });
    expect(result.value.servers[1]?.credentialReferences).toEqual({
      bearerTokenEnv: "API_TOKEN",
    });
  });

  it("parses Hermes YAML and retains disabled servers", () => {
    const result = parseHermesMcpConfig(`
      mcp_servers:
        github:
          url: https://example.com/mcp
          enabled: false
          headers:
            Authorization: Bearer secret
    `);

    expect(result.isOk() && result.value.servers[0]).toMatchObject({
      nativeName: "github",
      enabled: false,
      config: { transport: "http" },
      credentials: { headers: { Authorization: "Bearer secret" } },
    });
  });

  it("parses OpenClaw mcp.servers declarations", () => {
    const result = parseOpenclawMcpConfig(`{
      mcp: {
        servers: {
          local: { command: ["uvx", "local-mcp"], enabled: true },
        },
      },
    }`);

    expect(result.isOk() && result.value.servers[0]).toMatchObject({
      nativeName: "local",
      config: { transport: "stdio", command: "uvx", args: ["local-mcp"] },
    });
  });

  it("parses OpenCode v2 and legacy declarations", () => {
    const v2 = parseOpencodeMcpConfig(`{
      mcp: {
        servers: {
          local: {
            type: "local",
            command: ["npx", "-y", "local-mcp"],
            environment: { TOKEN: "secret" },
          },
        },
      },
    }`);
    const legacy = parseOpencodeMcpConfig(`{
      mcp: {
        remote: { type: "remote", url: "https://example.com/mcp" },
      },
    }`);

    expect(v2.isOk() && v2.value.servers[0]).toMatchObject({
      nativeName: "local",
      config: {
        transport: "stdio",
        command: "npx",
        args: ["-y", "local-mcp"],
      },
      credentials: { env: { TOKEN: "secret" } },
    });
    expect(legacy.isOk() && legacy.value.servers[0]).toMatchObject({
      nativeName: "remote",
      config: { transport: "http", url: "https://example.com/mcp" },
    });
  });

  it("isolates invalid server entries and rejects malformed source documents", () => {
    const partial = parseCursorMcpConfig(`{
      mcpServers: {
        good: { command: "npx", args: ["good-server"] },
        bad: { command: 42 },
      },
    }`);

    expect(partial.isOk()).toBe(true);
    if (partial.isOk()) {
      expect(partial.value.servers.map((server) => server.nativeName)).toEqual(["good"]);
      expect(partial.value.diagnostics).toEqual([
        expect.objectContaining({ code: "invalid-server", nativeName: "bad" }),
      ]);
    }

    expect(parseCursorMcpConfig("{").isErr()).toBe(true);
    expect(parseCursorMcpConfig("[]").isErr()).toBe(true);
    expect(parseCodexMcpConfig("[mcp_servers").isErr()).toBe(true);
    expect(parseHermesMcpConfig("mcp_servers: [unterminated").isErr()).toBe(true);
  });
});

import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getCapabilityConfigCandidates } from "./capabilityConfigCandidates";
import { scanMcpCapabilities } from "./scanMcpCapabilities";

const missingFile = () => Object.assign(new Error("missing"), { code: "ENOENT" });

describe("capability config discovery", () => {
  it("discovers supported global and workspace config locations without binary detection", () => {
    const candidates = getCapabilityConfigCandidates({
      homeDir: "/home/tester",
      workspacePath: "/work/project",
      env: { CODEX_HOME: "/custom/codex", XDG_CONFIG_HOME: "/custom/config" },
    });

    expect(new Set(candidates.map((candidate) => candidate.source))).toEqual(
      new Set(["claude-code", "codex", "cursor", "hermes", "openclaw", "opencode", "kimi-code"]),
    );
    expect(candidates).toContainEqual(
      expect.objectContaining({
        source: "codex",
        scope: "global",
        path: join("/custom/codex", "config.toml"),
      }),
    );
    expect(candidates).toContainEqual(
      expect.objectContaining({
        source: "claude-code",
        scope: "workspace",
        path: join("/work/project", ".mcp.json"),
      }),
    );
    expect(candidates).toContainEqual(
      expect.objectContaining({
        source: "kimi-code",
        scope: "workspace",
        path: join("/work/project", ".kimi-code", "mcp.json"),
      }),
    );
    expect(candidates.some((candidate) => candidate.source === "mastra")).toBe(false);
    expect(candidates.some((candidate) => candidate.source === "pi-agent")).toBe(false);
  });

  it("isolates missing and malformed files while retaining valid servers", async () => {
    const homeDir = "/home/tester";
    const validPath = join(homeDir, ".cursor", "mcp.json");
    const malformedPath = join(homeDir, ".kimi", "mcp.json");
    const files = new Map<string, string>([
      [
        validPath,
        JSON.stringify({
          mcpServers: {
            api: {
              command: "npx",
              env: { FILE_TOKEN: "literal-value" },
            },
            remote: {
              url: "https://example.com/mcp",
              headers: { Authorization: "Bearer literal-value" },
            },
          },
        }),
      ],
      [malformedPath, "{"],
    ]);

    const result = await scanMcpCapabilities({
      homeDir,
      env: {},
      readTextFile: (path) => {
        const value = files.get(path);

        return value === undefined ? Promise.reject(missingFile()) : Promise.resolve(value);
      },
    });

    expect(result.servers).toHaveLength(2);
    expect(result.servers[0]).toMatchObject({
      source: "cursor",
      nativeName: "api",
      config: { transport: "stdio", command: "npx" },
      credentials: { env: { FILE_TOKEN: "literal-value" } },
    });
    expect(result.servers[0]?.config).not.toHaveProperty("env");
    expect(result.servers[1]?.config).not.toHaveProperty("headers");
    expect(result.files).toContainEqual(
      expect.objectContaining({ path: malformedPath, status: "malformed" }),
    );
    expect(result.files.some((file) => file.status === "missing")).toBe(true);
  });

  it("resolves environment-backed credentials in memory without putting them in config", async () => {
    const homeDir = "/home/tester";
    const codexPath = join(homeDir, ".codex", "config.toml");
    const result = await scanMcpCapabilities({
      homeDir,
      env: { API_TOKEN: "runtime-value" },
      readTextFile: (path) =>
        path === codexPath
          ? Promise.resolve(`
              [mcp_servers.remote]
              url = "https://example.com/mcp"
              bearer_token_env_var = "API_TOKEN"
            `)
          : Promise.reject(missingFile()),
    });

    expect(result.servers[0]).toMatchObject({
      credentialReferences: { bearerTokenEnv: "API_TOKEN" },
      credentials: { headers: { Authorization: "Bearer runtime-value" } },
    });
    expect(result.servers[0]?.config).not.toHaveProperty("headers");
  });
});

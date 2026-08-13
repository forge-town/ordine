import type { McpCapabilityScanResult, SkillCapabilityScanResult } from "@repo/agent";
import { describe, expect, it } from "vitest";
import { createCredentialCipher } from "./credentialCipher";
import { createMcpSignature, prepareCapabilityHarvest } from "./prepareCapabilityHarvest";

const emptyMcpFiles: McpCapabilityScanResult["files"] = [];
const emptySkillRoots: SkillCapabilityScanResult["roots"] = [];

describe("prepareCapabilityHarvest", () => {
  it("deduplicates identical MCP identities and encrypts per-source credentials", () => {
    const cipher = createCredentialCipher("test-only-capability-secret")._unsafeUnwrap();
    const config = { transport: "stdio" as const, command: "npx", args: ["server-files"] };
    const mcpScan: McpCapabilityScanResult = {
      files: emptyMcpFiles,
      servers: [
        {
          sourceKey: "claude-source",
          source: "claude-code",
          scope: "global",
          path: "/home/test/.claude.json",
          nativeName: "files",
          enabled: true,
          config,
          credentials: { env: { TOKEN: "claude-plaintext" } },
        },
        {
          sourceKey: "codex-source",
          source: "codex",
          scope: "global",
          path: "/home/test/.codex/config.toml",
          nativeName: "filesystem",
          enabled: true,
          config,
          credentials: { env: { TOKEN: "codex-plaintext" } },
        },
      ],
    };
    const prepared = prepareCapabilityHarvest({
      mcpScan,
      skillScan: { skills: [], roots: emptySkillRoots, diagnostics: [] },
      cipher,
      now: new Date("2026-08-13T00:00:00.000Z"),
    })._unsafeUnwrap();

    expect(prepared.connectors).toHaveLength(1);
    expect(prepared.connectors[0]?.sources).toHaveLength(2);
    expect(Object.keys(prepared.connectors[0]!.encryptedCredentials)).toEqual([
      "claude-source",
      "codex-source",
    ]);
    expect(JSON.stringify(prepared)).not.toContain("claude-plaintext");
    expect(JSON.stringify(prepared)).not.toContain("codex-plaintext");
    expect(
      cipher
        .decrypt("claude-source", prepared.connectors[0]!.encryptedCredentials["claude-source"]!)
        ._unsafeUnwrap(),
    ).toEqual({ env: { TOKEN: "claude-plaintext" } });
  });

  it("keeps different stdio args as different connector identities", () => {
    expect(createMcpSignature({ transport: "stdio", command: "npx", args: ["a"] })).not.toBe(
      createMcpSignature({ transport: "stdio", command: "npx", args: ["b"] }),
    );
  });

  it("keeps different stdio working directories as different connector identities", () => {
    expect(
      createMcpSignature({ transport: "stdio", command: "node", cwd: "/workspace-a" }),
    ).not.toBe(createMcpSignature({ transport: "stdio", command: "node", cwd: "/workspace-b" }));
  });

  it("uses workspace MCP declarations instead of same-runtime global declarations", () => {
    const cipher = createCredentialCipher("test-only-capability-secret")._unsafeUnwrap();
    const prepared = prepareCapabilityHarvest({
      mcpScan: {
        files: emptyMcpFiles,
        servers: [
          {
            sourceKey: "global-source",
            source: "kimi-code",
            scope: "global",
            path: "/home/test/.kimi-code/mcp.json",
            nativeName: "github",
            enabled: true,
            config: { transport: "http", url: "https://global.example/mcp" },
          },
          {
            sourceKey: "workspace-source",
            source: "kimi-code",
            scope: "workspace",
            path: "/work/.kimi-code/mcp.json",
            nativeName: "github",
            enabled: true,
            config: { transport: "http", url: "https://workspace.example/mcp" },
          },
        ],
      },
      skillScan: { skills: [], roots: emptySkillRoots, diagnostics: [] },
      cipher,
      now: new Date("2026-08-13T00:00:00.000Z"),
    })._unsafeUnwrap();

    expect(prepared.connectors).toHaveLength(1);
    expect(prepared.connectors[0]?.config).toMatchObject({
      url: "https://workspace.example/mcp",
    });
  });

  it("merges duplicate skill names and retains all runtime sources", () => {
    const cipher = createCredentialCipher("test-only-capability-secret")._unsafeUnwrap();
    const skillScan: SkillCapabilityScanResult = {
      roots: emptySkillRoots,
      diagnostics: [],
      skills: [
        {
          name: "review-code",
          label: "Review Code",
          description: "Review code",
          path: "/home/test/.agents/skills/review/SKILL.md",
          sources: [
            { sourceKey: "codex-skill", source: "codex", scope: "global" },
            { sourceKey: "cursor-skill", source: "cursor", scope: "global" },
          ],
        },
        {
          name: "review-code",
          label: "Review Code",
          description: "Project override",
          path: "/work/.claude/skills/review/SKILL.md",
          sources: [{ sourceKey: "claude-skill", source: "claude-code", scope: "workspace" }],
        },
      ],
    };
    const prepared = prepareCapabilityHarvest({
      mcpScan: { servers: [], files: emptyMcpFiles },
      skillScan,
      cipher,
      now: new Date("2026-08-13T00:00:00.000Z"),
    })._unsafeUnwrap();

    expect(prepared.skills).toHaveLength(1);
    expect(prepared.skills[0]?.sources.map((source) => source.source)).toEqual([
      "codex",
      "cursor",
      "claude-code",
    ]);
    expect(prepared.skills[0]?.description).toBe("Project override");
  });
});

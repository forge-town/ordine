import { describe, expect, it } from "vitest";
import { ConnectorConfigSchema, isMcpConnectorConfig } from "./ConnectorConfigSchema";

describe("ConnectorConfigSchema", () => {
  it("parses a valid stdio config", () => {
    const parsed = ConnectorConfigSchema.parse({
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
      env: { TOKEN: "x" },
    });
    expect(isMcpConnectorConfig(parsed)).toBe(true);
  });

  it("parses a valid http config", () => {
    const parsed = ConnectorConfigSchema.parse({
      transport: "http",
      url: "https://mcp.example.com/sse",
      headers: { Authorization: "Bearer x" },
    });
    expect(isMcpConnectorConfig(parsed)).toBe(true);
  });

  it("tolerates the legacy empty object (existing rows)", () => {
    const parsed = ConnectorConfigSchema.parse({});
    expect(isMcpConnectorConfig(parsed)).toBe(false);
  });

  it("rejects a half-built stdio config (transport present, command missing)", () => {
    // 关键：带 transport 就必须走严格分支，不能从 legacy 宽松分支漏过去（假态防回归）。
    expect(() => ConnectorConfigSchema.parse({ transport: "stdio" })).toThrow();
  });

  it("rejects http config with a non-http url", () => {
    expect(() => ConnectorConfigSchema.parse({ transport: "http", url: "ftp://nope" })).toThrow();
  });

  it("rejects an unknown transport", () => {
    expect(() =>
      ConnectorConfigSchema.parse({ transport: "carrier-pigeon", command: "x" }),
    ).toThrow();
  });
});

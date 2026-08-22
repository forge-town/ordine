import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { probeMcpProtocol } from "../src/mcp/protocolDoctor";

describe("probeMcpProtocol", () => {
  it("proves initialize, tools/list, and a safe tools/call over stdio", async () => {
    const result = await probeMcpProtocol({
      command: process.execPath,
      args: [join(import.meta.dirname, "fixtures", "protocol-doctor-server.mjs")],
      env: {},
    });

    expect(result).toEqual({
      commandLaunchable: true,
      initialize: true,
      toolsList: true,
      safeToolCall: true,
      toolCount: 1,
    });
  });
});

import { join } from "node:path";
import { createServer } from "node:http";
import { describe, expect, it } from "vitest";
import { probeMcpProtocol } from "../src/mcp/protocolDoctor";

describe("probeMcpProtocol", () => {
  it("proves initialize, tools/list, and a safe tools/call over stdio", async () => {
    const result = await probeMcpProtocol(
      {
        command: process.execPath,
        args: [join(import.meta.dirname, "fixtures", "protocol-doctor-server.mjs")],
        env: {},
      },
      15_000,
      { environmentChecks: false },
    );

    expect(result).toMatchObject({
      commandLaunchable: true,
      initialize: true,
      toolsList: true,
      safeToolCall: true,
      toolCount: 7,
      requiredTools: {
        "ordine.list_pipelines": true,
        "ordine.create_pipeline": true,
        "ordine.create_operation": true,
        "ordine.update_operation": true,
        "ordine.run_pipeline": true,
        "ordine.list_jobs": true,
        "ordine.list_job_traces": true,
      },
    });
  });

  it("reports API, DB, runtime catalog, and write policy readiness", async () => {
    const httpServer = createServer((request, response) => {
      response.setHeader("Content-Type", "application/json");
      if (request.url === "/health") {
        response.end(JSON.stringify({ status: "ok" }));

        return;
      }
      if (request.url === "/api/agent-runtimes/catalog") {
        response.end(
          JSON.stringify([
            {
              runtime: "codex",
              availability: "launchable",
              runtimeConfigId: "local-codex",
            },
          ]),
        );

        return;
      }
      response.statusCode = 404;
      response.end(JSON.stringify({ error: "not found" }));
    });
    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    const address = httpServer.address();
    if (address === null || typeof address === "string") throw new Error("Expected TCP listener");

    const result = await probeMcpProtocol({
      command: process.execPath,
      args: [join(import.meta.dirname, "fixtures", "protocol-doctor-server.mjs")],
      env: { ORDINE_API_URL: `http://127.0.0.1:${address.port}` },
    });
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));

    expect(result).toMatchObject({
      commandLaunchable: true,
      initialize: true,
      toolsList: true,
      safeToolCall: true,
      workspaceContext: true,
      policyMode: "safe",
      allowWrite: true,
      allowIrreversible: false,
      writePolicy: "enabled",
      apiReachable: true,
      dbReachable: true,
      runtimeCatalogInitialized: true,
      runtimeCount: 1,
    });
  });
});

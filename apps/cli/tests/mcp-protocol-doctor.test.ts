import { createServer } from "node:http";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { probeMcpProtocol, REQUIRED_SESSION_READY_TOOLS } from "../src/mcp/protocolDoctor";

const startApiServer = async (catalog: unknown[]) => {
  const httpServer = createServer((request, response) => {
    response.setHeader("Content-Type", "application/json");
    if (request.url === "/health") {
      response.end(JSON.stringify({ status: "ok" }));

      return;
    }
    if (request.url === "/api/agent-runtimes/catalog") {
      response.end(JSON.stringify(catalog));

      return;
    }
    response.statusCode = 404;
    response.end(JSON.stringify({ error: "not found" }));
  });
  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const address = httpServer.address();
  if (address === null || typeof address === "string") throw new Error("Expected TCP listener");

  return {
    apiUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve) => httpServer.close(() => resolve())),
  };
};

const fixtureSpec = (env: Record<string, string> = {}) => ({
  command: process.execPath,
  args: [join(import.meta.dirname, "fixtures", "protocol-doctor-server.mjs")],
  env: {
    ORDINE_DOCTOR_FIXTURE_TOOLS: JSON.stringify(REQUIRED_SESSION_READY_TOOLS),
    ...env,
  },
});

describe("probeMcpProtocol", () => {
  it("proves initialize, the shared tool catalog, and a safe tools/call over stdio", async () => {
    const result = await probeMcpProtocol(fixtureSpec(), 15_000, {
      environmentChecks: false,
    });

    expect(result).toMatchObject({
      commandLaunchable: true,
      initialize: true,
      toolsList: true,
      safeToolCall: true,
      toolCount: REQUIRED_SESSION_READY_TOOLS.length,
      requiredTools: Object.fromEntries(
        REQUIRED_SESSION_READY_TOOLS.map((toolName) => [toolName, true]),
      ),
    });
  });

  it("reports API, DB, launchable runtime, and write policy readiness", async () => {
    const apiServer = await startApiServer([
      {
        runtime: "codex",
        availability: "launchable",
        runtimeConfigId: "local-codex",
      },
      {
        runtime: "claude-code",
        availability: "detected",
        runtimeConfigId: "local-claude-code",
      },
    ]);
    const result = await probeMcpProtocol(fixtureSpec({ ORDINE_API_URL: apiServer.apiUrl }));
    await apiServer.close();

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

  it("does not report a merely detected runtime as launchable", async () => {
    const apiServer = await startApiServer([
      {
        runtime: "codex",
        availability: "detected",
        runtimeConfigId: "local-codex",
      },
    ]);
    const result = await probeMcpProtocol(fixtureSpec({ ORDINE_API_URL: apiServer.apiUrl }));
    await apiServer.close();

    expect(result).toMatchObject({
      safeToolCall: true,
      apiReachable: true,
      dbReachable: true,
      runtimeCatalogInitialized: false,
      runtimeCount: 0,
      failureLayer: "runtime_catalog_empty",
    });
  });

  it("fails closed when the workspace context does not contain a valid policy", async () => {
    const apiServer = await startApiServer([
      {
        runtime: "codex",
        availability: "launchable",
        runtimeConfigId: "local-codex",
      },
    ]);
    const result = await probeMcpProtocol(
      fixtureSpec({
        ORDINE_API_URL: apiServer.apiUrl,
        ORDINE_DOCTOR_FIXTURE_CONTEXT: "{}",
      }),
    );
    await apiServer.close();

    expect(result).toMatchObject({
      commandLaunchable: true,
      initialize: true,
      toolsList: true,
      safeToolCall: false,
      workspaceContext: false,
      failureLayer: "workspace_context_unreadable",
    });
  });
});

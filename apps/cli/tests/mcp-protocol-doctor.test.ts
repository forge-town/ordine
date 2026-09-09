import { createServer } from "node:http";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { probeMcpProtocol, REQUIRED_SESSION_READY_TOOLS } from "../src/mcp/protocolDoctor";

const startApiServer = async (catalog: unknown, catalogStatus = 200) => {
  const headers: string[] = [];
  const httpServer = createServer((request, response) => {
    response.setHeader("Content-Type", "application/json");
    if (request.url === "/api/v2/readiness") {
      headers.push(request.headers.authorization ?? "");
      response.statusCode =
        request.headers.authorization === `Bearer ${"a".repeat(32)}` ? catalogStatus : 401;
      response.end(
        JSON.stringify(
          Array.isArray(catalog)
            ? {
                ordineApiVersion: 2,
                graphSchemaVersion: 2,
                buildRevision: "test",
                instanceId: "11111111-1111-4111-8111-111111111111",
                workspaceId: "workspace",
                mode: "service",
                status: "ready",
                database: { reachable: true, schemaVersion: 2 },
                capabilities: {
                  valueTypes: ["text", "json", "artifact"],
                  localAgentRuntimeIds: catalog
                    .filter((entry) => entry.availability === "launchable")
                    .map((entry) => entry.runtimeConfigId),
                },
                limits: {
                  maxNodes: 200,
                  maxEdges: 500,
                  maxRequestBytes: 12582912,
                  maxInlineValueBytes: 262144,
                },
              }
            : catalog,
        ),
      );

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
    headers,
    close: () => new Promise<void>((resolve) => httpServer.close(() => resolve())),
  };
};

const fixtureSpec = (env: Record<string, string> = {}) => ({
  command: process.execPath,
  args: [join(import.meta.dirname, "fixtures", "protocol-doctor-server.mjs")],
  env: {
    ORDINE_AUTH_MODE: "bearer",
    ORDINE_AGENT_API_TOKEN: "a".repeat(32),
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
    expect(apiServer.headers).toEqual([`Bearer ${"a".repeat(32)}`]);
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
    });
    expect(result.failureLayer).toBeUndefined();
  });

  it("reports incorrect credentials separately from an empty runtime catalog", async () => {
    const apiServer = await startApiServer([]);
    const result = await probeMcpProtocol(
      fixtureSpec({ ORDINE_API_URL: apiServer.apiUrl, ORDINE_AGENT_API_TOKEN: "b".repeat(32) }),
    );
    await apiServer.close();
    expect(result).toMatchObject({
      apiReachable: true,
      failureLayer: "authentication_failed",
      safeToolCall: false,
    });
  });

  it("reports unavailable capability discovery without mislabeling authentication", async () => {
    const apiServer = await startApiServer([], 503);
    const result = await probeMcpProtocol(fixtureSpec({ ORDINE_API_URL: apiServer.apiUrl }));
    await apiServer.close();
    expect(result).toMatchObject({ apiReachable: true, failureLayer: "api_unreachable" });
  });

  it("fails authentication configuration before starting the command", async () => {
    const result = await probeMcpProtocol({
      ...fixtureSpec({ ORDINE_AGENT_API_TOKEN: "" }),
      command: "must-not-launch",
    });
    expect(result).toMatchObject({
      commandLaunchable: false,
      failureLayer: "authentication_configuration",
    });
  });

  it("does not treat malformed capability data as an empty valid catalog", async () => {
    const apiServer = await startApiServer({ error: "unexpected object" });
    const result = await probeMcpProtocol(fixtureSpec({ ORDINE_API_URL: apiServer.apiUrl }));
    await apiServer.close();
    expect(result.failureLayer).toBe("capability_check_failed");
  });

  it("retains authentication failure from the actual MCP read call", async () => {
    const apiServer = await startApiServer([]);
    const result = await probeMcpProtocol(
      fixtureSpec({
        ORDINE_API_URL: apiServer.apiUrl,
        ORDINE_DOCTOR_FIXTURE_CALL_ERROR: "Failed to call ordine.v2.jobs.list: 401 Unauthorized",
      }),
    );
    await apiServer.close();
    expect(result).toMatchObject({ safeToolCall: false, failureLayer: "authentication_failed" });
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
  it("rejects a nominally successful MCP call with legacy job data", async () => {
    const result = await probeMcpProtocol(
      fixtureSpec({
        ORDINE_DOCTOR_FIXTURE_CALL_BODY: JSON.stringify([{ id: "old", status: "done" }]),
      }),
      15000,
      { environmentChecks: false },
    );
    expect(result).toMatchObject({ safeToolCall: false, failureLayer: "safe_tool_call_failed" });
  });
  it("refuses readiness when the database schema is not v2", async () => {
    const server = await startApiServer({
      ordineApiVersion: 2,
      graphSchemaVersion: 2,
      buildRevision: "test",
      instanceId: "11111111-1111-4111-8111-111111111111",
      workspaceId: "workspace",
      mode: "service",
      status: "not_ready",
      database: { reachable: true, schemaVersion: 1 },
      capabilities: { valueTypes: ["text"], localAgentRuntimeIds: [] },
      limits: {
        maxNodes: 200,
        maxEdges: 500,
        maxRequestBytes: 12582912,
        maxInlineValueBytes: 262144,
      },
    });
    const result = await probeMcpProtocol(fixtureSpec({ ORDINE_API_URL: server.apiUrl }));
    await server.close();
    expect(result).toMatchObject({
      apiReachable: true,
      dbReachable: true,
      safeToolCall: false,
      failureLayer: "db_unreachable",
    });
  });
});

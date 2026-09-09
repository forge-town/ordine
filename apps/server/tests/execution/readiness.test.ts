import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExecutionReadinessSchema, ExecutionErrorSchema } from "@repo/schemas";
import { createExecutionAuthMiddleware, type ExecutionAuthEnv } from "../../src/execution/auth";
import { createExecutionReadinessHandler } from "../../src/execution/readiness";

const token = "a".repeat(32);
const options = {
  buildRevision: "test-build",
  instanceId: "11111111-1111-4111-8111-111111111111",
  workspaceId: "workspace-1",
  mode: "service" as const,
  limits: {
    maxNodes: 200,
    maxEdges: 500,
    maxRequestBytes: 1024 * 1024,
    maxInlineValueBytes: 256 * 1024,
  },
  probeDatabase: async () => ({ reachable: true, schemaVersion: 2 }),
  listLocalRuntimeIds: async () => [],
};
const makeApp = (
  overrides: Partial<Parameters<typeof createExecutionReadinessHandler>[0]> = {},
) => {
  const app = new Hono<ExecutionAuthEnv>();
  app.use(
    "/api/v2/*",
    createExecutionAuthMiddleware({
      mode: "service",
      credentials: [
        {
          audience: "agent",
          transport: "bearer",
          subjectId: "owner",
          workspaceId: "workspace-1",
          scopes: ["execution:read"],
          token,
        },
      ],
    }),
  );
  app.get("/api/v2/readiness", createExecutionReadinessHandler({ ...options, ...overrides }));

  return app;
};
const request = (app: ReturnType<typeof makeApp>) =>
  app.request("/api/v2/readiness", {
    headers: { Authorization: `Bearer ${token}`, "X-Ordine-Api-Version": "2" },
  });

describe("execution readiness", () => {
  afterEach(() => vi.useRealTimers());

  it("clears probe timers and consumes probe rejections arriving after timeout", async () => {
    vi.useFakeTimers();
    const lateRejects: Array<(reason: unknown) => void> = [];
    const lateProbe = () =>
      new Promise<never>((_resolve, reject) => {
        lateRejects.push(reject);
      });
    for (const overrides of [
      {},
      {
        probeDatabase: async () => {
          throw new Error("unavailable");
        },
      },
      { probeDatabase: lateProbe, listLocalRuntimeIds: lateProbe },
    ]) {
      const pending = request(makeApp({ ...overrides, dependencyTimeoutMs: 10 }));
      await vi.runAllTimersAsync();
      await pending;
      expect(vi.getTimerCount()).toBe(0);
    }
    for (const reject of lateRejects) reject(new Error("late probe failure"));
    await vi.runAllTimersAsync();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("returns shared-schema readiness with an empty Agent directory", async () => {
    const response = await request(makeApp());
    expect(response.status).toBe(200);
    const result = ExecutionReadinessSchema.parse(await response.json());
    expect(result).toMatchObject({
      status: "ready",
      ordineApiVersion: 2,
      graphSchemaVersion: 2,
      database: { reachable: true, schemaVersion: 2 },
      capabilities: { localAgentRuntimeIds: [], valueTypes: ["text", "json", "artifact"] },
      limits: options.limits,
    });
    expect(JSON.stringify(result)).not.toContain(token);
  });

  it.each([
    { reachable: false, schemaVersion: null },
    { reachable: true, schemaVersion: 1 },
    { reachable: true, schemaVersion: null },
  ])("rejects database state %j", async (database) => {
    const response = await request(makeApp({ probeDatabase: async () => database }));
    expect(response.status).toBe(503);
    expect(ExecutionReadinessSchema.parse(await response.json())).toMatchObject({
      status: "not_ready",
      database,
    });
  });

  it("contains database errors and malformed probe output", async () => {
    for (const probeDatabase of [
      () => Promise.reject(new Error(token)),
      () => Promise.resolve({ reachable: true, schemaVersion: -1 }),
    ]) {
      const response = await request(makeApp({ probeDatabase }));
      expect(response.status).toBe(503);
      const body = await response.json();
      expect(ExecutionReadinessSchema.parse(body)).toMatchObject({
        status: "not_ready",
        database: { reachable: false, schemaVersion: null },
      });
      expect(JSON.stringify(body)).not.toContain(token);
    }
  });

  it("reports runtime probe failure separately while DB remains ready", async () => {
    const response = await request(
      makeApp({
        listLocalRuntimeIds: async () => {
          throw new Error(token);
        },
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Ordine-Readiness-Diagnostics")).toContain(
      "RUNTIME_CATALOG_UNAVAILABLE",
    );
    expect(ExecutionReadinessSchema.parse(await response.json())).toMatchObject({
      status: "ready",
      capabilities: { localAgentRuntimeIds: [] },
      database: { reachable: true, schemaVersion: 2 },
    });
  });

  it("bounds both dependency timeouts and signals cancellation", async () => {
    const signals: AbortSignal[] = [];
    const response = await request(
      makeApp({
        dependencyTimeoutMs: 10,
        probeDatabase: (signal) => {
          signals.push(signal);
          return new Promise(() => {});
        },
        listLocalRuntimeIds: (signal) => {
          signals.push(signal);
          return new Promise(() => {});
        },
      }),
    );
    expect(response.status).toBe(503);
    expect(ExecutionReadinessSchema.parse(await response.json()).status).toBe("not_ready");
    expect(signals).toHaveLength(2);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    expect(response.headers.get("X-Ordine-Readiness-Diagnostics")).toContain(
      "DATABASE_PROBE_TIMEOUT",
    );
    expect(response.headers.get("X-Ordine-Readiness-Diagnostics")).toContain(
      "RUNTIME_CATALOG_TIMEOUT",
    );
  });

  it("retains timeout diagnostics when a dependency rejects on abort", async () => {
    const response = await request(
      makeApp({
        dependencyTimeoutMs: 10,
        probeDatabase: (signal) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener("abort", () => reject(new Error("probe aborted")), {
              once: true,
            });
          }),
      }),
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("X-Ordine-Readiness-Diagnostics")).toBe("DATABASE_PROBE_TIMEOUT");
  });

  it("does not probe dependencies for unauthorized requests or invalid configuration", async () => {
    const probeDatabase = vi.fn(options.probeDatabase);
    const app = makeApp({ probeDatabase });
    expect(
      (await app.request("/api/v2/readiness", { headers: { "X-Ordine-Api-Version": "2" } })).status,
    ).toBe(401);
    const invalid = await request(makeApp({ probeDatabase, instanceId: "invalid" }));
    expect(invalid.status).toBe(500);
    expect(ExecutionErrorSchema.parse((await invalid.json()).error).code).toBe(
      "EXECUTION_READINESS_CONFIG_INVALID",
    );
    expect(probeDatabase).not.toHaveBeenCalled();
  });
});

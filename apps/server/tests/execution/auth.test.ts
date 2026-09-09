import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExecutionErrorSchema, ExecutionPrincipalSchema } from "@repo/schemas";
import { createExecutionAuthMiddleware, type ExecutionAuthEnv } from "../../src/execution/auth";

const token = "a".repeat(32);
const principal = {
  subjectId: "local-owner",
  workspaceId: "workspace-1",
  scopes: ["execution:read" as const],
};
const options = {
  ...principal,
  mode: "service" as const,
  token,
  allowedOrigins: ["https://app.example"],
};
const createApp = (
  overrides: Partial<Parameters<typeof createExecutionAuthMiddleware>[0]> &
    Partial<Parameters<typeof createExecutionAuthMiddleware>[0]["credentials"][number]> = {},
) => {
  const app = new Hono<ExecutionAuthEnv>();
  const merged = { ...options, ...overrides };
  app.use(
    "/api/v2/*",
    createExecutionAuthMiddleware({
      mode: merged.mode,
      allowedOrigins: merged.allowedOrigins,
      dependencyTimeoutMs: overrides.dependencyTimeoutMs,
      credentials: overrides.credentials ?? [
        {
          subjectId: merged.subjectId,
          workspaceId: merged.workspaceId,
          scopes: merged.scopes,
          audience: overrides.audience ?? "agent",
          transport: overrides.transport ?? (merged.mode === "desktop" ? "desktop" : "bearer"),
          token: merged.token,
          readToken: overrides.readToken,
        },
      ],
    }),
  );
  app.all("/api/v2/principal", (context) => context.json(context.get("principal")));

  return app;
};
const headers = { Authorization: `Bearer ${token}`, "X-Ordine-Api-Version": "2" };

afterEach(() => vi.useRealTimers());

describe("execution authentication boundary", () => {
  it("clears credential timers on success, rejection and timeout, and consumes late rejection", async () => {
    vi.useFakeTimers();
    const delayed: { reject?: (reason: unknown) => void } = {};
    const lateCredential = new Promise<string>((_resolve, reject) => {
      delayed.reject = reject;
    });
    for (const readToken of [
      () => Promise.resolve(token),
      () => Promise.reject(new Error("reader failed")),
      () => lateCredential,
    ]) {
      const pending = createApp({ token: undefined, readToken, dependencyTimeoutMs: 10 }).request(
        "/api/v2/principal",
        { headers },
      );
      await vi.runAllTimersAsync();
      await pending;
      expect(vi.getTimerCount()).toBe(0);
    }
    delayed.reject?.(new Error("late credential failure"));
    await vi.runAllTimersAsync();
    expect(vi.getTimerCount()).toBe(0);
  });
  it.each(["service", "desktop"] as const)(
    "authenticates %s without requiring the other identity",
    async (mode) => {
      const response = await createApp({ mode }).request("/api/v2/principal", {
        headers: {
          "X-Ordine-Api-Version": "2",
          ...(mode === "service"
            ? { Authorization: `Bearer ${token}` }
            : { "X-Desktop-Token": token }),
        },
      });
      expect(response.status).toBe(200);
      expect(ExecutionPrincipalSchema.parse(await response.json())).toEqual(principal);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
      const withOtherIdentity = await createApp({ mode }).request("/api/v2/principal", {
        headers: {
          "X-Ordine-Api-Version": "2",
          Authorization: mode === "service" ? `Bearer ${token}` : "Bearer invalid",
          "X-Desktop-Token": mode === "desktop" ? token : "invalid",
        },
      });
      expect(withOtherIdentity.status).toBe(200);
    },
  );

  it.each(["service", "desktop"] as const)(
    "does not fall back to the other header in %s mode",
    async (mode) => {
      const response = await createApp({ mode }).request("/api/v2/principal", {
        headers: {
          "X-Ordine-Api-Version": "2",
          ...(mode === "service"
            ? { "X-Desktop-Token": token }
            : { Authorization: `Bearer ${token}` }),
        },
      });
      expect(response.status).toBe(401);
      expect(ExecutionErrorSchema.parse((await response.json()).error).code).toBe(
        "EXECUTION_UNAUTHORIZED",
      );
    },
  );

  it.each([
    "",
    "Basic credentials",
    "Bearer short",
    `Bearer ${"b".repeat(32)}`,
    `Bearer ${token}extra`,
  ])("rejects a missing or invalid token", async (authorization) => {
    const response = await createApp().request("/api/v2/principal", {
      headers: { ...headers, Authorization: authorization },
    });
    expect(response.status).toBe(401);
    expect(await response.text()).not.toContain(token);
  });

  it.each([undefined, "1", "02", "2, 1", "invalid"])(
    "rejects missing or invalid API version %s",
    async (version) => {
      const response = await createApp().request("/api/v2/principal", {
        headers: {
          Authorization: headers.Authorization,
          ...(version === undefined ? {} : { "X-Ordine-Api-Version": version }),
        },
      });
      expect(response.status).toBe(426);
      expect(ExecutionErrorSchema.parse((await response.json()).error).code).toBe(
        "EXECUTION_API_VERSION_UNSUPPORTED",
      );
    },
  );

  it("allows trusted origins and rejects arbitrary or null origins before reading credentials", async () => {
    const readToken = vi.fn(async () => token);
    const app = createApp({ token: undefined, readToken });
    for (const origin of ["https://evil.example", "null", "https://app.example.evil.example"]) {
      const denied = await app.request("/api/v2/principal", {
        headers: { ...headers, Origin: origin },
      });
      expect(denied.status).toBe(403);
      expect(ExecutionErrorSchema.parse((await denied.json()).error).code).toBe(
        "EXECUTION_ORIGIN_DENIED",
      );
    }
    expect(readToken).not.toHaveBeenCalled();
    const allowed = await app.request("/api/v2/principal", {
      headers: { ...headers, Origin: "https://app.example" },
    });
    expect(allowed.status).toBe(200);
  });

  it("constructs principal exclusively from trusted configuration", async () => {
    const response = await createApp().request("/api/v2/principal", {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        "X-Subject-Id": "attacker",
        "X-Scopes": "execution:approve",
      },
      body: JSON.stringify({
        subjectId: "attacker",
        workspaceId: "other",
        scopes: ["execution:approve"],
        approved: true,
      }),
    });
    expect(await response.json()).toEqual(principal);
  });

  it("fails closed for absent, conflicting or invalid trusted configuration", async () => {
    for (const invalid of [
      { token: undefined },
      { token: "short" },
      { readToken: async () => token },
      { subjectId: "bad identifier" },
      { allowedOrigins: ["*"] },
    ]) {
      expect(() => createApp(invalid)).toThrow(
        "Execution authentication configuration is invalid.",
      );
    }
  });

  it("rereads a rotating token and bounds credential read errors and timeout", async () => {
    const readToken = vi
      .fn()
      .mockResolvedValueOnce(token)
      .mockResolvedValueOnce("b".repeat(32))
      .mockRejectedValueOnce(new Error(token));
    const app = createApp({ token: undefined, readToken });
    expect((await app.request("/api/v2/principal", { headers })).status).toBe(200);
    expect((await app.request("/api/v2/principal", { headers })).status).toBe(401);
    const failed = await app.request("/api/v2/principal", { headers });
    expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain(token);
    const timedOut = await createApp({
      token: undefined,
      readToken: () => new Promise(() => {}),
      dependencyTimeoutMs: 10,
    }).request("/api/v2/principal", { headers });
    expect(timedOut.status).toBe(503);
    expect(ExecutionErrorSchema.parse((await timedOut.json()).error).code).toBe(
      "EXECUTION_AUTH_UNAVAILABLE",
    );
  });
  it("rejects duplicate static credentials and agent approval scopes at construction", () => {
    const slot = { ...principal, audience: "agent" as const, transport: "bearer" as const, token };
    for (const credentials of [
      [],
      Array.from({ length: 17 }, () => slot),
      [slot, { ...slot, audience: "app" as const, scopes: ["execution:approve" as const] }],
      [{ ...slot, scopes: ["execution:approve" as const] }],
    ]) {
      expect(() => createApp({ credentials })).toThrow(
        "Execution authentication configuration is invalid.",
      );
    }
  });
  it("isolates App and Agent scopes on the same transport without trusting Origin", async () => {
    const appToken = "b".repeat(32);
    const app = createApp({
      credentials: [
        { ...principal, audience: "agent", transport: "desktop", token },
        {
          ...principal,
          audience: "app",
          transport: "desktop",
          token: appToken,
          scopes: ["execution:read", "execution:approve"],
        },
      ],
    });
    for (const [credential, scopes] of [
      [token, ["execution:read"]],
      [appToken, ["execution:read", "execution:approve"]],
    ] as const) {
      const response = await app.request("/api/v2/principal", {
        headers: {
          "X-Ordine-Api-Version": "2",
          "X-Desktop-Token": credential,
          Origin: "https://app.example",
          "X-Scopes": "execution:approve",
        },
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ...principal, scopes });
    }
  });
  it("fails closed when independently rotating credentials become identical", async () => {
    const readApp = vi.fn().mockResolvedValueOnce("b".repeat(32)).mockResolvedValueOnce(token);
    const app = createApp({
      credentials: [
        { ...principal, audience: "agent", transport: "bearer", token },
        {
          ...principal,
          audience: "app",
          transport: "desktop",
          readToken: readApp,
          scopes: ["execution:approve"],
        },
      ],
    });
    expect((await app.request("/api/v2/principal", { headers })).status).toBe(200);
    const response = await app.request("/api/v2/principal", { headers });
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe("EXECUTION_AUTH_CONFIG_INVALID");
  });
});
